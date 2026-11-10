import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1000) <= 900;

async function openBlank(page: Page) {
  await page.goto('./?tool=crest');
  await page.getByRole('button', { name: /Чистый лист/ }).click();
  await expect(page.locator('svg.canvas')).toBeVisible();
}

async function autosaved(page: Page) {
  await page.waitForTimeout(700);
  return page.evaluate(() => JSON.parse(localStorage.getItem('family-crest:autosave:v1') ?? 'null'));
}

async function addSymbol(page: Page, name: string) {
  if (isMobile(page)) await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await page.getByRole('tab', { name: 'Символы' }).click();
  await page.getByLabel('Поиск символов').fill(name);
  await page.getByRole('button', { name, exact: true }).first().click();
}

test('стартовый экран: шаблоны открываются и редактор не пишет ошибок', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('./?tool=crest');
  await expect(page.getByRole('heading', { name: 'Герб семьи' })).toBeVisible();
  for (const name of ['Классический щит', 'Четыре опоры', 'Две линии рода', 'Медальон', 'Дерево рода', 'Небо и море', 'Три поколения', 'Наш путь']) {
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  }
  await page.getByRole('button', { name: /Четыре опоры/ }).click();
  await expect(page.locator('svg.canvas [data-id]')).toHaveCount(7);
  expect(errors).toEqual([]);
});

test('чистый лист: добавление, перетаскивание, отмена, автосохранение и восстановление', async ({ page }) => {
  await openBlank(page);
  await expect(page.locator('svg.canvas [data-id]')).toHaveCount(0);
  await addSymbol(page, 'Лев');
  await expect(page.locator('svg.canvas [data-id]')).toHaveCount(1);

  const sym = page.locator('svg.canvas [data-id]').first();
  const before = await sym.boundingBox();
  const c = { x: before!.x + before!.width / 2, y: before!.y + before!.height / 2 };
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 60, c.y + 40, { steps: 6 });
  await page.mouse.up();
  const after = await sym.boundingBox();
  expect(after!.x).toBeGreaterThan(before!.x + 30);
  expect(after!.y).toBeGreaterThan(before!.y + 20);

  await page.getByRole('button', { name: /Отменить/ }).click();
  const undone = await sym.boundingBox();
  expect(Math.abs(undone!.x - before!.x)).toBeLessThan(2);

  const saved = await autosaved(page);
  expect(saved.layers).toHaveLength(1);
  expect(saved.layers[0].symbol).toBe('lion');

  await page.reload();
  await page.getByRole('button', { name: /Продолжить/ }).click();
  await expect(page.locator('svg.canvas [data-id]')).toHaveCount(1);
});

test('ручка масштаба и поворота меняют слой', async ({ page }) => {
  test.skip(isMobile(page), 'на телефоне масштаб меняется щипком, ручки проверяются на компьютере');
  await openBlank(page);
  await addSymbol(page, 'Дуб');
  const sym = page.locator('svg.canvas [data-id]').first();
  const box = (await sym.boundingBox())!;
  // на пустом холсте символ добавляется со смещением, поэтому выбираем его явно
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const scaleHandle = page.locator('svg.canvas [data-handle="scale"]').last();
  const h = (await scaleHandle.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2 + 80, h.y + h.height / 2 + 80, { steps: 8 });
  await page.mouse.up();
  const rot = page.locator('svg.canvas [data-handle="rotate"]').last();
  const r = (await rot.boundingBox())!;
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width / 2 + 120, r.y + r.height / 2 + 60, { steps: 8 });
  await page.mouse.up();
  const saved = await autosaved(page);
  expect(saved.layers[0].scale).toBeGreaterThan(1.2);
  expect(Math.abs(saved.layers[0].rotation)).toBeGreaterThan(10);
});

test('привязка к полям: символ встаёт в поле, перетаскивание открепляет, освободившееся поле занимает следующий', async ({ page }) => {
  test.skip(isMobile(page), 'перетаскивание мышью проверяется на компьютере');
  await openBlank(page);
  await page.getByRole('tab', { name: 'Щит' }).click();
  await page.getByRole('button', { name: 'Добавить щит' }).click();
  await addSymbol(page, 'Лев');
  const symbolsOf = async () => (await autosaved(page)).layers.filter((l: { kind: string }) => l.kind === 'symbol');
  let symbols = await symbolsOf();
  expect(symbols[0].slot).toBeDefined();

  const lion = page.locator('svg.canvas [data-id]').nth(1);
  const b = (await lion.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 5, b.y + b.height / 2 + 160, { steps: 8 });
  await page.mouse.up();
  symbols = await symbolsOf();
  expect(symbols[0].slot).toBeUndefined();
  expect(symbols[0].y).toBeGreaterThan(700);

  await addSymbol(page, 'Дуб');
  symbols = await symbolsOf();
  expect(symbols[1].slot).toBeDefined(); // поле освободилось, дуб встал в него
});

test('никаких внешних запросов', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const external: string[] = [];
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u);
  });
  await page.goto('./?tool=crest');
  await page.getByRole('button', { name: /Медальон/ }).click();
  await page.waitForTimeout(500);
  expect(external).toEqual([]);
});

test('экспорт в SVG, PNG и PDF', async ({ page }) => {
  test.skip(isMobile(page), 'экспорт проверяется на компьютере');
  await page.goto('./?tool=crest');
  await page.getByRole('button', { name: /Классический щит/ }).click();
  await page.getByPlaceholder('Название семьи (для PDF)').fill('Ивановы');
  // заметка попадёт в PDF
  const lion = page.locator('svg.canvas [data-id]').nth(2);
  const lb = (await lion.boundingBox())!;
  await page.mouse.click(lb.x + lb.width / 2, lb.y + lb.height / 2);
  await page.getByPlaceholder(/Что для вас значит/).fill('Мы всегда держимся вместе');
  const dir = mkdtempSync(join(tmpdir(), 'gerb-'));

  const grab = async (format: 'PNG' | 'PDF' | 'SVG', ext: string) => {
    await page.getByRole('button', { name: 'Скачать', exact: true }).first().click();
    await page.getByRole('radio', { name: new RegExp(format) }).click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('dialog').getByRole('button', { name: 'Скачать', exact: true }).click()]);
    expect(dl.suggestedFilename()).toBe(`gerb-Ивановы${format === 'PNG' ? '-2048' : ''}.${ext}`);
    const path = join(dir, dl.suggestedFilename());
    await dl.saveAs(path);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    return path;
  };

  const svg = readFileSync(await grab('SVG', 'svg'), 'utf8');
  expect(svg).toContain('<svg');
  expect(svg).not.toMatch(/<text|<image|<foreignObject|<filter|<pattern/);
  expect(svg).toContain('game-icons.net');

  const png = readFileSync(await grab('PNG', 'png'));
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.readUInt32BE(16)).toBe(2048);
  expect(png.readUInt32BE(20)).toBe(2458);

  const pdfPath = await grab('PDF', 'pdf');
  const info = execFileSync('pdfinfo', [pdfPath]).toString();
  expect(info).toMatch(/Pages:\s+2/);
  expect(info).toMatch(/A4/);
  const out = join(dir, 'p');
  execFileSync('pdftoppm', ['-r', '50', '-png', pdfPath, out]);
  const p1 = readFileSync(`${out}-1.png`);
  const p2 = readFileSync(`${out}-2.png`);
  expect(p1.length).toBeGreaterThan(8000); // страницы не пустые
  expect(p2.length).toBeGreaterThan(5000);
  writeFileSync(join(dir, 'where.txt'), dir);
});

test('на телефоне панели переключаются, холст виден', async ({ page }) => {
  test.skip(!isMobile(page), 'только телефон');
  await openBlank(page);
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить щит' }).or(page.getByRole('tab', { name: 'Щит' })).first().click();
  await expect(page.locator('svg.canvas')).toBeVisible();
  const box = (await page.locator('svg.canvas').boundingBox())!;
  expect(box.width).toBeGreaterThan(200);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Слои', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Слои' })).toBeVisible();
});

test('стереть мои данные очищает хранилище', async ({ page }) => {
  await openBlank(page);
  await addSymbol(page, 'Дуб');
  expect(await autosaved(page)).not.toBeNull();
  page.once('dialog', (d) => d.accept());
  await page.goto('./?tool=crest');
  await page.getByRole('button', { name: 'Стереть мои данные' }).click();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => localStorage.getItem('family-crest:autosave:v1'))).toBeNull();
});

test('английский интерфейс: переключение, запоминание, подписи и экспорт', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('./?tool=crest');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await page.getByRole('button', { name: 'English' }).click();

  await expect(page.getByRole('heading', { name: 'Family crest' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle('Family crest — Family Studio');
  for (const name of ['Classic shield', 'Four pillars', 'Two family lines', 'Medallion', 'Family tree', 'Sky and sea', 'Three generations', 'Our path']) {
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  }
  expect(await page.locator('body').innerText()).not.toMatch(/[А-Яа-яЁё]/);

  // выбор запоминается
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Family crest' })).toBeVisible();

  await page.getByRole('button', { name: /Classic shield/ }).click();
  await expect(page.locator('svg.canvas')).toBeVisible();
  await page.getByPlaceholder('Family name (for the PDF)').fill('Ivanov');
  if (isMobile(page)) await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('tab', { name: 'Animals' }).click();
  await expect(page.getByRole('button', { name: 'Lion', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Symbols' }).click();
  await page.getByLabel('Search symbols').fill('anchor');
  await expect(page.getByRole('button', { name: 'Anchor', exact: true }).or(page.getByRole('button', { name: 'Fleet', exact: true })).first()).toBeVisible();

  if (!isMobile(page)) {
    await page.getByRole('button', { name: 'Download', exact: true }).first().click();
    await page.getByRole('radio', { name: /SVG/ }).click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('dialog').getByRole('button', { name: 'Download', exact: true }).click()]);
    expect(dl.suggestedFilename()).toBe('family-crest-Ivanov.svg');
    const dir = mkdtempSync(join(tmpdir(), 'crest-'));
    await dl.saveAs(join(dir, 'c.svg'));
    const svg = readFileSync(join(dir, 'c.svg'), 'utf8');
    expect(svg).toContain('The Ivanov family crest');
    expect(svg).toContain('Icons: game-icons.net');
    expect(svg).not.toMatch(/[А-Яа-яЁё]/);
  }

  // обратно на русский: интерфейс снова русский
  await page.getByRole('button', { name: 'Русский' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.getByPlaceholder('Название семьи (для PDF)')).toBeVisible();
  expect(errors).toEqual([]);
});
