import { expect, test, type Page } from '@playwright/test';

const KEY = 'family-studio:my-family:autosave:v1';
const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1000) <= 900;

const sheet = (page: Page) => page.locator('svg.mf-sheet');
const figures = (page: Page) => page.locator('svg.mf-sheet [data-fig]');
const shape = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

async function open(page: Page) {
  await page.goto('./?only=my-family');
  await expect(sheet(page)).toBeVisible();
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
  await page.getByRole('button', { name: 'Новый рисунок' }).click();
  await expect(sheet(page)).toHaveAttribute('viewBox', other);
  await expect(figures(page)).toHaveCount(0);
});

test('новый рисунок: отказ в подтверждении ничего не меняет', async ({ page }) => {
  await open(page);
  await shape(page, 'Круг').click();
  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('button', { name: 'Новый рисунок' }).click();
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
  for (const name of ['Круг', 'Квадрат', 'Прямоугольник', 'Треугольник', 'Предыдущая фигура', 'Следующая фигура', 'Новый рисунок']) {
    const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
    expect(box.width, name).toBeGreaterThanOrEqual(40);
    expect(box.height, name).toBeGreaterThanOrEqual(40);
  }
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
