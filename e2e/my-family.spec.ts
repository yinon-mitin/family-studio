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

// ---------- shape properties ----------

const props = (page: Page) => page.getByRole('group', { name: 'Свойства фигуры' });
const colorButtons = (page: Page) => props(page).getByRole('group', { name: 'Цвет' }).getByRole('button');
const textureButtons = (page: Page) => props(page).getByRole('group', { name: 'Фактура' }).getByRole('button');
const sizeSlider = (page: Page) => props(page).getByRole('slider', { name: /^Размер/ });
const rotationSlider = (page: Page) => props(page).getByRole('slider', { name: /^Поворот/ });
const act = (page: Page, name: string) => props(page).getByRole('button', { name, exact: true });
const order = (page: Page) => figures(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-fig')));
const storedOrder = async (page: Page) => (await autosaved(page)).figures.map((f: { id: string }) => f.id);

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
  expect((await autosaved(page)).figures[0].color).toBe('#fb8c00');

  await sizeSlider(page).fill('200');
  await textureButtons(page).filter({ hasText: 'Клетка' }).click();
  await expect(textureButtons(page).filter({ hasText: 'Клетка' })).toHaveAttribute('aria-pressed', 'true');
  await rotationSlider(page).fill('45');
  const f = (await autosaved(page)).figures[0];
  expect(f).toMatchObject({ size: 200, texture: 'checks', rotation: 45 });

  await textureButtons(page).filter({ hasText: 'Без фактуры' }).click();
  expect((await autosaved(page)).figures[0].texture).toBeNull();
});

test('свойства: слайдер не склеивает правки разных фигур и сливается в один шаг отмены', async ({ page }) => {
  await open(page);
  await shape(page, 'Круг').click();
  await shape(page, 'Квадрат').click();
  await sizeSlider(page).fill('150');
  await sizeSlider(page).fill('180'); // the same gesture: one undo step
  await page.getByRole('button', { name: '↶ Отменить' }).click();
  expect((await autosaved(page)).figures[1].size).toBe(100);
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
  expect(await storedOrder(page)).toEqual([c, a, b]);

  await act(page, 'Выше').click();
  expect(await order(page)).toEqual([a, c, b]);
  await act(page, 'Ниже').click();
  expect(await order(page)).toEqual([c, a, b]);
  await act(page, 'На передний план').click();
  expect(await order(page)).toEqual([a, b, c]);

  await act(page, 'Дублировать').click();
  await expect(figures(page)).toHaveCount(4);
  await expect(props(page)).toBeVisible(); // the copy is selected
  expect(await storedOrder(page)).toHaveLength(4);
});

test('свойства: «Удалить» убирает фигуру, «Отменить» возвращает', async ({ page }) => {
  await open(page);
  await shape(page, 'Круг').click();
  await shape(page, 'Квадрат').click();
  await act(page, 'Удалить').click();
  await expect(figures(page)).toHaveCount(1);
  await expect(props(page)).toHaveCount(0);
  expect(await storedOrder(page)).toHaveLength(1);
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
  const saved = (await autosaved(page)).figures;
  expect(saved.map((f: { color: string }) => f.color)).toEqual(['#fdd835', '#43a047']);
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

test('Backspace удаляет выбранную фигуру, но не в поле ввода', async ({ page }) => {
  await open(page);
  await shape(page, 'Круг').click();
  await shape(page, 'Квадрат').click();
  await sizeSlider(page).focus(); // focus in an input: the key belongs to the control
  await page.keyboard.press('Backspace');
  await expect(figures(page)).toHaveCount(2);
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  await page.keyboard.press('Backspace');
  await expect(figures(page)).toHaveCount(1);
});

test('последняя правка не теряется при закрытии страницы раньше 400 мс', async ({ page }) => {
  await open(page);
  await shape(page, 'Круг').click();
  const stored = await page.evaluate((key) => {
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
