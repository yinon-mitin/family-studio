import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

// Temp directories made by a test are removed after it, even when it fails.
const tmpDirs: string[] = [];
const makeTmp = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'semya-'));
  tmpDirs.push(dir);
  return dir;
};
test.afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const KEY = 'family-studio:my-family:autosave:v1';
const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1000) <= 900;

const sheet = (page: Page) => page.locator('svg.mf-sheet');
const figures = (page: Page) => page.locator('svg.mf-sheet [data-fig]');
const shape = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

async function open(page: Page) {
  await page.goto('./?only=my-family');
  await expect(sheet(page)).toBeVisible();
}

const fileMenu = (page: Page) => page.locator('.mf-bar details.menu');
const menuItem = (page: Page, name: string) => fileMenu(page).getByRole('button', { name, exact: true });
/** Starts a new drawing through the file menu (the only place for it). */
async function chooseNewDrawing(page: Page) {
  await fileMenu(page).locator('summary').click();
  await menuItem(page, 'Новый рисунок').click();
}

async function autosaved(page: Page) {
  await page.waitForTimeout(700);
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), KEY);
}

/** Screen point of a place on the sheet, given in sheet units. */
async function onSheet(page: Page, x: number, y: number) {
  const box = (await sheet(page).boundingBox())!;
  const [, , w, h] = (await sheet(page).getAttribute('viewBox'))!.split(' ').map(Number);
  return { x: box.x + (box.width * x) / w, y: box.y + (box.height * y) / h };
}

async function centre(page: Page, nth: number) {
  const box = (await figures(page).nth(nth).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test('добавление фигур и подсказка', async ({ page }) => {
  await open(page);
  const hint = page.getByText('Выберите фигуру, чтобы положить её на лист');
  await expect(hint).toBeVisible();
  await expect(figures(page)).toHaveCount(0);
  await shape(page, 'Круг').click();
  await shape(page, 'Квадрат').click();
  await expect(figures(page)).toHaveCount(2);
  await expect(hint).toHaveCount(0);
});

test('ориентация листа по устройству', async ({ page }) => {
  const mobile = isMobile(page);
  const own = mobile ? '0 0 1000 1414' : '0 0 1414 1000';
  const other = mobile ? '0 0 1414 1000' : '0 0 1000 1414';
  await open(page);
  await expect(sheet(page)).toHaveAttribute('viewBox', own);
  await shape(page, 'Круг').click();

  // the viewport is turned: the existing drawing keeps its sheet
  const { width, height } = page.viewportSize()!;
  await page.setViewportSize({ width: height, height: width });
  await expect(sheet(page)).toHaveAttribute('viewBox', own);
  await expect(figures(page)).toHaveCount(1);

  // a new drawing picks the orientation again
  page.once('dialog', (d) => d.accept());
  await chooseNewDrawing(page);
  await expect(sheet(page)).toHaveAttribute('viewBox', other);
  await expect(figures(page)).toHaveCount(0);
});

test('новый рисунок: отказ в подтверждении ничего не меняет', async ({ page }) => {
  await open(page);
  await shape(page, 'Круг').click();
  page.once('dialog', (d) => d.dismiss());
  await chooseNewDrawing(page);
  await expect(figures(page)).toHaveCount(1);
});

test('фигура не выходит за лист', async ({ page }) => {
  await open(page);
  await shape(page, 'Круг').click();
  const { width, height } = page.viewportSize()!;
  const c = await centre(page, 0);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(width + 400, height + 400, { steps: 8 });
  await page.mouse.up();
  const saved = await autosaved(page);
  const f = saved.figures[0];
  const [w, h] = saved.orientation === 'landscape' ? [1414, 1000] : [1000, 1414];
  expect(f.x + f.size / 2).toBeLessThanOrEqual(w);
  expect(f.y + f.size / 2).toBeLessThanOrEqual(h);
  expect(f.x - f.size / 2).toBeGreaterThanOrEqual(0);
  expect(f.y - f.size / 2).toBeGreaterThanOrEqual(0);
  expect(f.x).toBeGreaterThan(w / 2); // it did move
});

test('прерванный жест не залипает', async ({ page }) => {
  await open(page);
  await shape(page, 'Круг').click();
  const c = await centre(page, 0);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 40, c.y + 30, { steps: 5 });
  await sheet(page).dispatchEvent('pointercancel', { pointerId: 1, bubbles: true });
  const stopped = await figures(page).first().boundingBox();
  await page.mouse.move(c.x + 160, c.y + 120, { steps: 5 });
  const later = await figures(page).first().boundingBox();
  await page.mouse.up();
  expect(stopped!.x).toBeGreaterThan(c.x - stopped!.width / 2 + 20); // the gesture did move the figure before the cancel
  expect(Math.abs(later!.x - stopped!.x)).toBeLessThan(1);
  expect(Math.abs(later!.y - stopped!.y)).toBeLessThan(1);
});

test('выбор и перекрытие', async ({ page }) => {
  await open(page);
  await shape(page, 'Круг').click();
  await shape(page, 'Квадрат').click(); // the second one lands 40 units aside
  await expect(figures(page)).toHaveCount(2);
  const next = page.getByRole('button', { name: 'Следующая фигура' });
  await expect(figures(page).nth(1)).toHaveAttribute('data-selected', 'true');
  await next.click();
  await expect(figures(page).nth(0)).toHaveAttribute('data-selected', 'true');
  await expect(figures(page).nth(1)).not.toHaveAttribute('data-selected', 'true');
  await next.click();
  await expect(figures(page).nth(1)).toHaveAttribute('data-selected', 'true');
  await page.getByRole('button', { name: 'Предыдущая фигура' }).click();
  await expect(figures(page).nth(0)).toHaveAttribute('data-selected', 'true');
});

test('полностью закрытая фигура выбирается кнопкой, пустое место снимает выбор', async ({ page }) => {
  await page.goto('./?only=my-family');
  const doc = {
    version: 1,
    orientation: 'portrait',
    figures: [
      { id: 'small', kind: 'circle', x: 500, y: 600, size: 60, rotation: 0, color: '#e53935', texture: null },
      { id: 'big', kind: 'square', x: 500, y: 600, size: 260, rotation: 0, color: '#42a5f5', texture: null },
    ],
  };
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [KEY, JSON.stringify(doc)]);
  await page.reload();
  await expect(figures(page)).toHaveCount(2);

  // pressing the middle picks the top figure; the circle underneath cannot be reached with the pointer
  const mid = await onSheet(page, 500, 600);
  await page.mouse.click(mid.x, mid.y);
  await expect(page.locator('[data-fig="big"]')).toHaveAttribute('data-selected', 'true');

  await page.getByRole('button', { name: 'Предыдущая фигура' }).click();
  await expect(page.locator('[data-fig="small"]')).toHaveAttribute('data-selected', 'true');
  await expect(page.locator('[data-fig="big"]')).not.toHaveAttribute('data-selected', 'true');

  const empty = await onSheet(page, 100, 100);
  await page.mouse.click(empty.x, empty.y);
  await expect(page.locator('svg.mf-sheet [data-selected]')).toHaveCount(0);
});

test('стрелки сдвигают, Delete удаляет, Ctrl+Z возвращает', async ({ page }) => {
  await open(page);
  await shape(page, 'Квадрат').click();
  const before = (await autosaved(page)).figures[0];
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowDown');
  const moved = (await autosaved(page)).figures[0];
  expect(moved.x).toBeCloseTo(before.x + 4, 5);
  expect(moved.y).toBeCloseTo(before.y + 20, 5);
  await page.keyboard.press('Delete');
  await expect(figures(page)).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(figures(page)).toHaveCount(1);
  await page.keyboard.press('Control+y');
  await expect(figures(page)).toHaveCount(0);
});

test('восстановление после перезагрузки', async ({ page }) => {
  await open(page);
  await shape(page, 'Круг').click();
  await shape(page, 'Треугольник').click();
  await shape(page, 'Прямоугольник').click();
  const ids = await figures(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-fig')));
  const viewBox = await sheet(page).getAttribute('viewBox');
  await autosaved(page);
  await page.reload();
  await expect(figures(page)).toHaveCount(3);
  expect(await figures(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-fig')))).toEqual(ids);
  await expect(sheet(page)).toHaveAttribute('viewBox', viewBox!);
});

test('кнопки не меньше 40 пикселей и лист помещается на экране', async ({ page }) => {
  await open(page);
  for (const name of ['Круг', 'Квадрат', 'Прямоугольник', 'Треугольник', 'Предыдущая фигура', 'Следующая фигура']) {
    const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
    expect(box.width, name).toBeGreaterThanOrEqual(40);
    expect(box.height, name).toBeGreaterThanOrEqual(40);
  }
  // the file menu: its button, the download button and every menu item
  const barButtons = [fileMenu(page).locator('summary'), page.locator('.mf-bar').getByRole('button', { name: 'Скачать', exact: true })];
  await fileMenu(page).locator('summary').click();
  for (const name of ['Новый рисунок', 'Сохранить в файл', 'Открыть из файла']) barButtons.push(menuItem(page, name));
  for (const [i, b] of barButtons.entries()) {
    const box = (await b.boundingBox())!;
    expect(box.height, `bar ${i}`).toBeGreaterThanOrEqual(40);
    expect(box.width, `bar ${i}`).toBeGreaterThanOrEqual(40);
  }
  await fileMenu(page).locator('summary').click();
  const s = (await sheet(page).boundingBox())!;
  const { width, height } = page.viewportSize()!;
  expect(s.width).toBeGreaterThan(200);
  expect(s.x + s.width).toBeLessThanOrEqual(width);
  expect(s.y + s.height).toBeLessThanOrEqual(height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('по умолчанию открывается «Моя семья», вкладки переключают инструменты', async ({ page }) => {
  await page.goto('./');
  await expect(sheet(page)).toBeVisible();
  await expect(page).toHaveTitle('Моя семья — Студия семьи');
  await page.getByRole('navigation', { name: 'Инструменты' }).getByRole('button', { name: 'Герб семьи' }).click();
  await expect(page.getByRole('heading', { name: 'Герб семьи' })).toBeVisible();
});

// ---------- shape properties ----------

const props = (page: Page) => page.getByRole('group', { name: 'Свойства фигуры' });
const colorButtons = (page: Page) => props(page).getByRole('group', { name: 'Цвет' }).getByRole('button');
const textureButtons = (page: Page) => props(page).getByRole('group', { name: 'Фактура' }).getByRole('button');
const sizeSlider = (page: Page) => props(page).getByRole('slider', { name: /^Размер/ });
const rotationSlider = (page: Page) => props(page).getByRole('slider', { name: /^Поворот/ });
const act = (page: Page, name: string) => props(page).getByRole('button', { name, exact: true });
const order = (page: Page) => figures(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-fig')));
const readStored = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), KEY);
/** Waits (no fixed sleep) until the autosave holds a document that satisfies `ok`, and returns it. */
async function storedWhere(page: Page, ok: (doc: { figures: Record<string, any>[] }) => boolean) {
  const holds = (doc: unknown) => doc !== null && ok(doc as { figures: Record<string, any>[] });
  await expect.poll(async () => holds(await readStored(page)), { timeout: 5000 }).toBe(true);
  return (await readStored(page)) as { figures: Record<string, any>[] };
}
const storedIds = (page: Page) => readStored(page).then((d) => (d?.figures ?? []).map((f: { id: string }) => f.id));

test('свойства: без выбранной фигуры панели нет, при выборе видны все элементы', async ({ page }) => {
  await open(page);
  await expect(props(page)).toHaveCount(0);
  await shape(page, 'Круг').click();
  await expect(props(page)).toBeVisible();

  await expect(colorButtons(page)).toHaveCount(13);
  await expect(colorButtons(page).first()).toHaveAccessibleName('Красный');
  await expect(colorButtons(page).nth(12)).toHaveAccessibleName('Белый');
  await expect(sizeSlider(page)).toHaveAttribute('min', '30');
  await expect(sizeSlider(page)).toHaveAttribute('max', '260');
  await expect(rotationSlider(page)).toHaveAttribute('min', '0');
  await expect(rotationSlider(page)).toHaveAttribute('max', '345');
  await expect(rotationSlider(page)).toHaveAttribute('step', '15');
  await expect(textureButtons(page)).toHaveCount(6);
  for (const name of ['Без фактуры', 'Штриховка', 'Клетка', 'Точки', 'Волны', 'Ромбы']) await expect(textureButtons(page).filter({ hasText: name })).toHaveCount(1);
  for (const name of ['Выше', 'Ниже', 'На передний план', 'На задний план', 'Дублировать', 'Удалить']) await expect(act(page, name)).toBeVisible();

  // the current choice is exposed, not only painted
  await expect(colorButtons(page).nth(5)).toHaveAttribute('aria-pressed', 'true'); // the default blue
  await expect(textureButtons(page).first()).toHaveAttribute('aria-pressed', 'true'); // plain

  // touch targets
  for (const b of [colorButtons(page).first(), colorButtons(page).nth(12), textureButtons(page).nth(1), act(page, 'Выше'), act(page, 'Удалить')]) {
    const box = (await b.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(40);
    expect(box.height).toBeGreaterThanOrEqual(40);
  }

  await page.keyboard.press('Escape');
  await expect(props(page)).toHaveCount(0);
});

test('свойства: цвет, размер, фактура и поворот попадают в автосохранение', async ({ page }) => {
  await open(page);
  await shape(page, 'Квадрат').click();
  await colorButtons(page).nth(1).click();
  await expect(colorButtons(page).nth(1)).toHaveAttribute('aria-pressed', 'true');
  await storedWhere(page, (d) => d.figures[0].color === '#fb8c00');

  await sizeSlider(page).fill('200');
  await textureButtons(page).filter({ hasText: 'Клетка' }).click();
  await expect(textureButtons(page).filter({ hasText: 'Клетка' })).toHaveAttribute('aria-pressed', 'true');
  await rotationSlider(page).fill('45');
  const doc = await storedWhere(page, (d) => d.figures[0].size === 200 && d.figures[0].texture === 'checks' && d.figures[0].rotation === 45);
  expect(doc.figures[0]).toMatchObject({ size: 200, texture: 'checks', rotation: 45 });

  await textureButtons(page).filter({ hasText: 'Без фактуры' }).click();
  await storedWhere(page, (d) => d.figures[0].texture === null);
});

test('свойства: слайдер не склеивает правки разных фигур и сливается в один шаг отмены', async ({ page }) => {
  await open(page);
  await shape(page, 'Круг').click();
  await shape(page, 'Квадрат').click();
  await sizeSlider(page).fill('150');
  await sizeSlider(page).fill('180'); // the same gesture: one undo step
  await storedWhere(page, (d) => d.figures[1].size === 180);
  await page.getByRole('button', { name: '↶ Отменить' }).click();
  await storedWhere(page, (d) => d.figures[1].size === 100);
});

test('свойства: порядок слоёв и дублирование', async ({ page }) => {
  await open(page);
  await shape(page, 'Круг').click();
  await shape(page, 'Квадрат').click();
  await shape(page, 'Треугольник').click();
  const [a, b, c] = await order(page);

  await act(page, 'Выше').click(); // the top one stays
  expect(await order(page)).toEqual([a, b, c]);

  await act(page, 'На задний план').click();
  expect(await order(page)).toEqual([c, a, b]);
  await expect.poll(() => storedIds(page)).toEqual([c, a, b]);

  await act(page, 'Выше').click();
  expect(await order(page)).toEqual([a, c, b]);
  await act(page, 'Ниже').click();
  expect(await order(page)).toEqual([c, a, b]);
  await act(page, 'На передний план').click();
  expect(await order(page)).toEqual([a, b, c]);

  await act(page, 'Дублировать').click();
  await expect(figures(page)).toHaveCount(4);
  await expect(props(page)).toBeVisible(); // the copy is selected
  await expect.poll(async () => (await storedIds(page)).length).toBe(4);
});

test('свойства: «Удалить» убирает фигуру, «Отменить» возвращает', async ({ page }) => {
  await open(page);
  await shape(page, 'Круг').click();
  await shape(page, 'Квадрат').click();
  await act(page, 'Удалить').click();
  await expect(figures(page)).toHaveCount(1);
  await expect(props(page)).toHaveCount(0);
  await expect.poll(async () => (await storedIds(page)).length).toBe(1);
  await page.getByRole('button', { name: '↶ Отменить' }).click();
  await expect(figures(page)).toHaveCount(2);
});

test('свойства: панель следует за новым выбором, а не за прежним', async ({ page }) => {
  await open(page);
  await shape(page, 'Круг').click();
  await colorButtons(page).nth(2).click(); // yellow
  await shape(page, 'Квадрат').click();
  await expect(colorButtons(page).nth(5)).toHaveAttribute('aria-pressed', 'true');
  await colorButtons(page).nth(3).click(); // green goes to the square only
  await page.getByRole('button', { name: 'Предыдущая фигура' }).click();
  await expect(colorButtons(page).nth(2)).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => ((await readStored(page))?.figures ?? []).map((f: { color: string }) => f.color)).toEqual(['#fdd835', '#43a047']);
});

// ---------- keyboard and gestures ----------

test('горячие клавиши работают на русской раскладке', async ({ page }) => {
  await open(page);
  await shape(page, 'Круг').click();
  await shape(page, 'Квадрат').click();
  const press = (code: string, key: string, shift = false) =>
    page.evaluate(([c, k, s]) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c as string, key: k as string, ctrlKey: true, shiftKey: s as boolean, bubbles: true, cancelable: true })), [code, key, shift]);
  await press('KeyZ', 'я');
  await expect(figures(page)).toHaveCount(1);
  await press('KeyY', 'н');
  await expect(figures(page)).toHaveCount(2);
  await press('KeyZ', 'Я', true); // Ctrl+Shift+Z redoes too, undo first
  await expect(figures(page)).toHaveCount(2);
  await press('KeyZ', 'я');
  await expect(figures(page)).toHaveCount(1);
  await press('KeyZ', 'Я', true);
  await expect(figures(page)).toHaveCount(2);
});

test('Backspace удаляет выбранную фигуру, но не в текстовом поле', async ({ page }) => {
  await open(page);
  await shape(page, 'Круг').click();
  await shape(page, 'Квадрат').click();
  // a text field (none in the app itself): the key belongs to it
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'probe';
    document.body.append(input);
    input.focus();
  });
  await page.keyboard.press('Backspace');
  await expect(figures(page)).toHaveCount(2);
  // a slider is not a text field: Backspace deletes the shape
  await sizeSlider(page).focus();
  await page.keyboard.press('Backspace');
  await expect(figures(page)).toHaveCount(1);
  await page.keyboard.press('Control+z');
  await expect(figures(page)).toHaveCount(2);
});

test('после слайдера работают Ctrl+Z, а стрелки остаются слайдеру', async ({ page }) => {
  await open(page);
  await shape(page, 'Круг').click();
  await storedWhere(page, (d) => d.figures.length === 1);
  const before = (await readStored(page)).figures[0];
  await sizeSlider(page).fill('200');
  await storedWhere(page, (d) => d.figures[0].size === 200);
  await page.keyboard.press('Control+z'); // the focus is still on the slider
  await storedWhere(page, (d) => d.figures[0].size === 100);

  await rotationSlider(page).focus();
  await page.keyboard.press('ArrowRight'); // turns the slider, does not nudge the shape
  const after = await storedWhere(page, (d) => d.figures[0].rotation === 15);
  expect(after.figures[0].x).toBe(before.x);
  expect(after.figures[0].y).toBe(before.y);
});

test('последняя правка не теряется при закрытии страницы раньше 400 мс', async ({ page }) => {
  await open(page);
  // all in one task: the change, the pagehide and the read happen far inside the 400 ms debounce
  const stored = await page.evaluate((key) => {
    [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Круг')!.click();
    window.dispatchEvent(new Event('pagehide'));
    return localStorage.getItem(key);
  }, KEY);
  expect(JSON.parse(stored ?? 'null')?.figures).toHaveLength(1);
});

async function dragFigure(page: Page, nth: number, dx: number, dy: number) {
  const c = await centre(page, nth);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + dx, c.y + dy, { steps: 4 });
  await page.mouse.up();
}

test('два быстрых перетаскивания — два шага отмены', async ({ page }) => {
  await open(page);
  await shape(page, 'Круг').click();
  const start = await centre(page, 0);
  await dragFigure(page, 0, 60, 30);
  const first = await centre(page, 0);
  await dragFigure(page, 0, 60, 30);
  const second = await centre(page, 0);
  expect(second.x).toBeGreaterThan(first.x + 30);
  await page.keyboard.press('Control+z');
  const undone = await centre(page, 0);
  expect(Math.abs(undone.x - first.x)).toBeLessThan(1);
  expect(first.x).toBeGreaterThan(start.x + 30);
  await page.keyboard.press('Control+z');
  expect(Math.abs((await centre(page, 0)).x - start.x)).toBeLessThan(1);
});

test('жест, у которого не пришёл конец, не блокирует следующий', async ({ page }) => {
  await open(page);
  await shape(page, 'Круг').click();
  const c = await centre(page, 0);
  // a finger went down and its pointerup never arrived
  await figures(page).first().dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0, clientX: c.x, clientY: c.y, bubbles: true });
  await dragFigure(page, 0, 80, 50);
  const moved = await centre(page, 0);
  expect(moved.x).toBeGreaterThan(c.x + 40);
});

test('на телефоне лист не меняет размер и фигура не прыгает при выборе перетаскиванием', async ({ page }) => {
  test.skip(!isMobile(page), 'the panel sits below the sheet only on narrow screens');
  await open(page);
  await shape(page, 'Круг').click();
  await shape(page, 'Круг').click(); // the second circle lands 40 units aside: the first one's middle stays free
  const empty = await onSheet(page, 100, 100);
  await page.mouse.click(empty.x, empty.y); // nothing is selected now
  await expect(props(page)).toHaveCount(0);
  const before = (await sheet(page).boundingBox())!;
  const c = await centre(page, 0);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down(); // selects the figure; the properties appear
  await expect(props(page)).toBeVisible();
  await page.mouse.move(c.x + 30, c.y + 20, { steps: 6 });
  await page.mouse.up();
  const after = (await sheet(page).boundingBox())!;
  expect(after.x).toBeCloseTo(before.x, 0);
  expect(after.y).toBeCloseTo(before.y, 0);
  expect(after.width).toBeCloseTo(before.width, 0);
  expect(after.height).toBeCloseTo(before.height, 0);
  const moved = await centre(page, 0);
  expect(Math.abs(moved.x - (c.x + 30))).toBeLessThan(1.5);
  expect(Math.abs(moved.y - (c.y + 20))).toBeLessThan(1.5);
});

// ---------- file menu, export dialog ----------

const exportDialog = (page: Page) => page.getByRole('dialog', { name: 'Скачать рисунок' });
const goButton = (page: Page) => exportDialog(page).getByRole('button', { name: 'Скачать', exact: true });
const dropdown = (page: Page) => page.locator('.mf-bar details.menu');
const portrait = (page: Page) => isMobile(page); // phones get a portrait sheet, wide screens a landscape one

async function threeFigures(page: Page) {
  await shape(page, 'Круг').click();
  await shape(page, 'Квадрат').click();
  await shape(page, 'Треугольник').click();
  await page.getByRole('group', { name: 'Фактура' }).getByRole('button', { name: 'Штриховка' }).click();
  await expect(figures(page)).toHaveCount(3);
}

async function grab(page: Page, dir: string, format: 'PNG' | 'SVG' | 'PDF') {
  await page.locator('.mf-bar').getByRole('button', { name: 'Скачать', exact: true }).click();
  await expect(exportDialog(page)).toBeVisible();
  await exportDialog(page).getByRole('radio', { name: new RegExp(format) }).click();
  const [dl] = await Promise.all([page.waitForEvent('download'), goButton(page).click()]);
  const path = join(dir, dl.suggestedFilename());
  await dl.saveAs(path);
  await expect(exportDialog(page)).toHaveCount(0);
  return { path, name: dl.suggestedFilename() };
}

/** Reads a binary PPM (P6) and counts the pixels that are not pure white. */
function nonWhitePixels(ppm: Buffer): number {
  let pos = 0;
  const token = () => {
    while (/\s/.test(String.fromCharCode(ppm[pos]))) pos++;
    let out = '';
    while (!/\s/.test(String.fromCharCode(ppm[pos]))) out += String.fromCharCode(ppm[pos++]);
    return out;
  };
  expect(token()).toBe('P6');
  const w = Number(token());
  const h = Number(token());
  token(); // max value
  pos++; // one whitespace byte before the pixels
  let n = 0;
  for (let i = 0; i < w * h; i++) {
    const o = pos + i * 3;
    if (ppm[o] !== 255 || ppm[o + 1] !== 255 || ppm[o + 2] !== 255) n++;
  }
  return n;
}

test('экспорт: SVG, PNG и PDF из диалога', async ({ page }) => {
  await open(page);
  await threeFigures(page);
  const dir = makeTmp();

  const svgFile = await grab(page, dir, 'SVG');
  expect(svgFile.name).toBe('moya-semya.svg');
  const svg = readFileSync(svgFile.path, 'utf8');
  expect(svg).not.toContain('<pattern');
  expect(svg).not.toContain('<text');
  expect(svg.match(/data-fig=/g)).toHaveLength(3);

  const pngFile = await grab(page, dir, 'PNG');
  expect(pngFile.name).toBe('moya-semya.png');
  const png = readFileSync(pngFile.path);
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.subarray(12, 16).toString()).toBe('IHDR');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual(portrait(page) ? [1240, 1753] : [1753, 1240]);

  const pdfFile = await grab(page, dir, 'PDF');
  expect(pdfFile.name).toBe('moya-semya.pdf');
  const info = execFileSync('pdfinfo', [pdfFile.path]).toString();
  expect(info).toMatch(/Pages:\s+1\b/);
  // pdfinfo rounds differently between poppler versions (595.28 or 595.276), so compare numbers, not text
  const [, pw, ph] = info.match(/Page size:\s+([\d.]+) x ([\d.]+) pts/)!;
  const [ew, eh] = portrait(page) ? [595.276, 841.89] : [841.89, 595.276];
  expect(Math.abs(Number(pw) - ew)).toBeLessThan(0.01);
  expect(Math.abs(Number(ph) - eh)).toBeLessThan(0.01);
  // The page is not blank: three figures (one textured) leave coloured pixels on the white sheet.
  const out = join(dir, 'page');
  execFileSync('pdftoppm', ['-r', '50', '-f', '1', '-l', '1', pdfFile.path, out]);
  const ppm = readFileSync(`${out}-1.ppm`);
  expect(nonWhitePixels(ppm)).toBeGreaterThan(1500);
});

test('экспорт: пустой лист не скачивается', async ({ page }) => {
  await open(page);
  await page.locator('.mf-bar').getByRole('button', { name: 'Скачать', exact: true }).click();
  await expect(exportDialog(page)).toBeVisible();
  await expect(exportDialog(page).getByText('Лист пока пустой. Добавьте хотя бы одну фигуру.')).toBeVisible();
  await expect(goButton(page)).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(exportDialog(page)).toHaveCount(0);
});

test('экспорт: сбой показывает сообщение, диалог остаётся рабочим', async ({ page }) => {
  await page.addInitScript(() => {
    const real = URL.createObjectURL.bind(URL);
    (window as unknown as { __fail: boolean }).__fail = true;
    URL.createObjectURL = (obj: Blob | MediaSource) => {
      if ((window as unknown as { __fail: boolean }).__fail) throw new Error('boom');
      return real(obj);
    };
  });
  await open(page);
  await shape(page, 'Круг').click();
  await page.locator('.mf-bar').getByRole('button', { name: 'Скачать', exact: true }).click();
  await exportDialog(page).getByRole('radio', { name: /SVG/ }).click();
  await goButton(page).click();
  await expect(page.getByRole('status')).toHaveText('Не удалось создать файл. Попробуйте ещё раз или выберите другой формат.');
  await expect(exportDialog(page)).toBeVisible();
  await expect(goButton(page)).toBeEnabled();
  // and it works again once the cause is gone
  await page.evaluate(() => ((window as unknown as { __fail: boolean }).__fail = false));
  const [dl] = await Promise.all([page.waitForEvent('download'), goButton(page).click()]);
  expect(dl.suggestedFilename()).toBe('moya-semya.svg');
});

test('меню «Файл»: закрывается по Escape и по щелчку снаружи', async ({ page }) => {
  await open(page);
  await dropdown(page).locator('summary').click();
  await expect(menuItem(page, 'Сохранить в файл')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menuItem(page, 'Сохранить в файл')).toBeHidden();
  await dropdown(page).locator('summary').click();
  await expect(menuItem(page, 'Сохранить в файл')).toBeVisible();
  await page.locator('svg.mf-sheet').click({ position: { x: 5, y: 5 } });
  await expect(menuItem(page, 'Сохранить в файл')).toBeHidden();
});

test('файл: сохранить, начать заново и открыть — фигуры и ориентация возвращаются', async ({ page }) => {
  await open(page);
  await threeFigures(page);
  const viewBox = await sheet(page).getAttribute('viewBox');
  const before = await order(page);
  const dir = makeTmp();

  await dropdown(page).locator('summary').click();
  const [dl] = await Promise.all([page.waitForEvent('download'), menuItem(page, 'Сохранить в файл').click()]);
  expect(dl.suggestedFilename()).toBe('moya-semya.json');
  const path = join(dir, 'moya-semya.json');
  await dl.saveAs(path);
  await expect(page.getByRole('status')).toHaveText('Рисунок сохранён в файл');
  const saved = JSON.parse(readFileSync(path, 'utf8'));
  expect(saved.app).toBe('family-studio-my-family');

  // the file keeps the orientation of the moment, not the screen's
  saved.doc.orientation = viewBox === '0 0 1000 1414' ? 'landscape' : 'portrait';
  const other = viewBox === '0 0 1000 1414' ? '0 0 1414 1000' : '0 0 1000 1414';
  const flipped = join(dir, 'flipped.json');
  writeFileSync(flipped, JSON.stringify(saved));

  page.once('dialog', (d) => d.accept());
  await chooseNewDrawing(page);
  await expect(figures(page)).toHaveCount(0);

  await page.locator('input[type=file]').setInputFiles(path);
  await expect(figures(page)).toHaveCount(3);
  expect(await order(page)).toEqual(before);
  await expect(sheet(page)).toHaveAttribute('viewBox', viewBox!);

  // the same file can be opened twice in a row (a figure is added first so that opening asks)
  await shape(page, 'Круг').click();
  page.once('dialog', (d) => d.accept());
  await page.locator('input[type=file]').setInputFiles(path);
  await expect(figures(page)).toHaveCount(3);

  // history of the opened drawing starts empty, orientation comes from the file
  await expect(page.getByRole('button', { name: /Отменить/ })).toBeDisabled();
  page.once('dialog', (d) => d.accept());
  await page.locator('input[type=file]').setInputFiles(flipped);
  await expect(sheet(page)).toHaveAttribute('viewBox', other);
  await expect(figures(page)).toHaveCount(3);
  const stored = await storedWhere(page, (d) => d.figures.length === 3);
  expect(stored.figures).toHaveLength(3);
});

test('файл: открытие просит подтверждение, отказ ничего не меняет', async ({ page }) => {
  await open(page);
  await shape(page, 'Круг').click();
  await dropdown(page).locator('summary').click();
  const [dl] = await Promise.all([page.waitForEvent('download'), menuItem(page, 'Сохранить в файл').click()]);
  const path = join(makeTmp(), 'a.json');
  await dl.saveAs(path);
  await shape(page, 'Квадрат').click();
  await expect(figures(page)).toHaveCount(2);
  let asked = '';
  page.once('dialog', (d) => {
    asked = d.message();
    void d.dismiss();
  });
  await page.locator('input[type=file]').setInputFiles(path);
  await expect.poll(() => asked).toBe('Открыть файл? Текущий рисунок будет заменён.');
  await expect(figures(page)).toHaveCount(2);
});

test('файл: чужие и слишком большие файлы отклоняются, лист не меняется', async ({ page }) => {
  await open(page);
  await shape(page, 'Круг').click();
  const dir = makeTmp();
  const input = page.locator('input[type=file]');
  let asked = false;
  page.on('dialog', (d) => {
    asked = true;
    void d.dismiss();
  });

  const crest = join(dir, 'crest.json');
  writeFileSync(crest, JSON.stringify({ app: 'family-crest', version: 1, doc: { layers: [] } }));
  await input.setInputFiles(crest);
  await expect(page.getByRole('status')).toHaveText('Не удалось открыть: это не файл проекта «Моей семьи»');
  await expect(figures(page)).toHaveCount(1);

  const junk = join(dir, 'junk.json');
  writeFileSync(junk, '{ not json');
  await input.setInputFiles(junk);
  await expect(page.getByRole('status')).toHaveText('Не удалось открыть: это не файл проекта «Моей семьи»');

  const big = join(dir, 'big.json');
  writeFileSync(big, Buffer.alloc(5_000_001, 32));
  await input.setInputFiles(big);
  await expect(page.getByRole('status')).toHaveText('Файл слишком большой для проекта «Моей семьи»');
  await expect(figures(page)).toHaveCount(1);
  expect(asked).toBe(false); // nothing valid was read, so nothing asked for consent
});

test('новый рисунок: согласие очищает лист и историю', async ({ page }) => {
  await open(page);
  await shape(page, 'Круг').click();
  await shape(page, 'Квадрат').click();
  let asked = '';
  page.once('dialog', (d) => {
    asked = d.message();
    void d.accept();
  });
  await chooseNewDrawing(page);
  expect(asked).toBe('Начать новый рисунок? Текущий будет заменён.');
  await expect(figures(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Отменить/ })).toBeDisabled();
  await page.keyboard.press('Control+z');
  await expect(figures(page)).toHaveCount(0);
});

test('кнопка «Новый рисунок» вне меню не осталась', async ({ page }) => {
  await open(page);
  await expect(page.locator('.mf-bar').getByRole('button', { name: 'Новый рисунок', exact: true })).toHaveCount(0);
});

test('новый рисунок: после перезагрузки прежний рисунок не возвращается', async ({ page }) => {
  await open(page);
  await shape(page, 'Круг').click();
  await shape(page, 'Квадрат').click();
  await expect.poll(() => storedIds(page)).toHaveLength(2);
  page.once('dialog', (d) => d.accept());
  await chooseNewDrawing(page);
  await expect(figures(page)).toHaveCount(0);
  expect(await readStored(page)).toBeNull(); // gone at once, not after the autosave pause
  await page.reload();
  await expect(sheet(page)).toBeVisible();
  await expect(figures(page)).toHaveCount(0);
  await page.waitForTimeout(700);
  expect(await readStored(page)).toBeNull();
});

test('экспорт: если лист опустел за диалогом, скачивать нечего', async ({ page }) => {
  await open(page);
  await shape(page, 'Круг').click();
  await expect(figures(page)).toHaveCount(1);
  await page.locator('.mf-bar').getByRole('button', { name: 'Скачать', exact: true }).click();
  await expect(exportDialog(page)).toBeVisible();
  await expect(goButton(page)).toBeEnabled();
  let downloads = 0;
  page.on('download', () => downloads++);
  await page.keyboard.press('Control+z'); // the shortcut works behind the dialog and empties the sheet
  await expect(figures(page)).toHaveCount(0);
  await expect(exportDialog(page).getByText('Лист пока пустой. Добавьте хотя бы одну фигуру.')).toBeVisible();
  await expect(goButton(page)).toBeDisabled();
  await page.waitForTimeout(300);
  expect(downloads).toBe(0);
  // and the button wakes up again when a figure comes back
  await page.keyboard.press('Control+y');
  await expect(figures(page)).toHaveCount(1);
  await expect(goButton(page)).toBeEnabled();
});

test('экспорт: закрытый во время создания файла диалог ничего не скачивает', async ({ page }) => {
  await page.addInitScript(() => {
    const real = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (cb, ...rest) {
      // a slow PNG: the file is ready 1.2 s later, and the page notes the moment
      setTimeout(() => real.call(this, (b) => (cb(b), ((window as unknown as { __pngReady: boolean }).__pngReady = true)), ...rest), 1200);
    };
  });
  await open(page);
  await shape(page, 'Круг').click();
  let downloads = 0;
  page.on('download', () => downloads++);
  await page.locator('.mf-bar').getByRole('button', { name: 'Скачать', exact: true }).click();
  await goButton(page).click();
  await expect(exportDialog(page).getByRole('button', { name: 'Готовлю файл…' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(exportDialog(page)).toHaveCount(0);
  await page.waitForFunction(() => (window as unknown as { __pngReady?: boolean }).__pngReady === true);
  await page.waitForTimeout(500); // time for a wrong download to happen
  expect(downloads).toBe(0);
  await expect(page.getByRole('status')).toHaveCount(0); // no "done" message for a file nobody got
});

test('файл: сбой при сохранении показывает сообщение', async ({ page }) => {
  await page.addInitScript(() => {
    URL.createObjectURL = () => {
      throw new Error('boom');
    };
  });
  await open(page);
  await shape(page, 'Круг').click();
  await dropdown(page).locator('summary').click();
  await menuItem(page, 'Сохранить в файл').click();
  await expect(page.getByRole('status')).toHaveText('Не удалось создать файл. Попробуйте ещё раз или выберите другой формат.');
  await expect(figures(page)).toHaveCount(1); // the app is still alive
});

test('никаких внешних запросов: добавление, перетаскивание, диалог скачивания, сохранение', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await open(page);
  await shape(page, 'Круг').click();
  const c = await centre(page, 0);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 50, c.y + 40, { steps: 5 });
  await page.mouse.up();
  await page.locator('.mf-bar').getByRole('button', { name: 'Скачать', exact: true }).click();
  await expect(exportDialog(page)).toBeVisible();
  await exportDialog(page).getByRole('button', { name: 'Закрыть' }).click();
  await expect(exportDialog(page)).toHaveCount(0);
  await dropdown(page).locator('summary').click();
  const [dl] = await Promise.all([page.waitForEvent('download'), menuItem(page, 'Сохранить в файл').click()]);
  expect(dl.suggestedFilename()).toBe('moya-semya.json');
  await page.waitForTimeout(500);
  expect(requests.length).toBeGreaterThan(0);
  const own = (u: string) => u.startsWith(origin) || u.startsWith('data:') || u.startsWith('blob:');
  expect(requests.filter((u) => !own(u))).toEqual([]);
});
