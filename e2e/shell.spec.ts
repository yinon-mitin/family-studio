import { expect, test, type Page } from '@playwright/test';

test('оболочка: полоса с названием и один переключатель языка над гербом', async ({ page }) => {
  await page.goto('./?tool=crest');
  await expect(page.getByText('Студия семьи', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Студия семьи' })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Язык' })).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Герб семьи' })).toBeVisible();
  await expect(page).toHaveTitle('Герб семьи — Студия семьи');
});

test('английский: название вкладки и оболочки', async ({ page }) => {
  await page.goto('./?tool=crest');
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page).toHaveTitle('Family crest — Family Studio');
  await expect(page.getByText('Family Studio', { exact: true })).toBeVisible();
});

test('?only=crest показывает только герб, без вкладок', async ({ page }) => {
  await page.goto('./?only=crest');
  await expect(page.getByRole('navigation', { name: 'Инструменты' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Герб семьи' })).toBeVisible();
});

test('полоса не прячет редактор', async ({ page }) => {
  await page.goto('./?tool=crest');
  await page.getByRole('button', { name: /Чистый лист/ }).click();
  const canvas = page.locator('svg.canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  const height = page.viewportSize()!.height;
  expect(box!.y + box!.height).toBeLessThanOrEqual(height);
});

const AUTOSAVE_KEY = 'family-crest:autosave:v1';
const readAutosave = (page: Page) => page.evaluate((key) => localStorage.getItem(key), AUTOSAVE_KEY);

/** Чистый лист герба с одним символом (вкладка «Герб семьи» уже открыта). */
async function startCrest(page: Page) {
  await page.getByRole('button', { name: /Чистый лист/ }).click();
  await expect(page.locator('svg.canvas')).toBeVisible();
  if ((page.viewportSize()?.width ?? 1000) <= 900) await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await page.getByRole('tab', { name: 'Символы' }).click();
  await page.getByLabel('Поиск символов').fill('Дуб');
  await page.getByRole('button', { name: 'Дуб', exact: true }).first().click();
}

/** Чистый лист с одним символом; ждёт, пока автосохранение (400 мс) ляжет в localStorage. */
async function crestWithAutosave(page: Page) {
  await page.goto('./?tool=crest');
  await startCrest(page);
  await expect.poll(() => readAutosave(page)).not.toBeNull();
}

test('«Стереть все мои данные» очищает хранилище', async ({ page }) => {
  await crestWithAutosave(page);
  page.once('dialog', (d) => d.accept());
  await page.getByText('Данные', { exact: true }).click();
  await page.getByRole('button', { name: 'Стереть все мои данные' }).click();
  // автосохранение дебаунсится на 400 мс: ждём дольше, чтобы убедиться, что пустой лист не записался обратно
  await page.waitForTimeout(900);
  expect(await readAutosave(page)).toBeNull();
  await expect(page.getByRole('button', { name: /Чистый лист/ })).toBeVisible();
});

test('стирание на экране «Продолжить»: карточка исчезает и герб не возвращается', async ({ page }) => {
  await crestWithAutosave(page);
  await page.reload(); // the start screen with the continue card
  const card = page.getByRole('button', { name: /Продолжить/ });
  await expect(card).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await page.getByText('Данные', { exact: true }).click();
  await page.getByRole('button', { name: 'Стереть все мои данные' }).click();
  await expect(card).toHaveCount(0);
  await page.waitForTimeout(900);
  expect(await readAutosave(page)).toBeNull();
  await page.reload();
  await expect(page.getByRole('button', { name: /Чистый лист/ })).toBeVisible();
  await expect(card).toHaveCount(0);
  expect(await readAutosave(page)).toBeNull();
});

test('отказ в подтверждении ничего не стирает', async ({ page }) => {
  await crestWithAutosave(page);
  page.once('dialog', (d) => d.dismiss());
  await page.getByText('Данные', { exact: true }).click();
  await page.getByRole('button', { name: 'Стереть все мои данные' }).click();
  await page.waitForTimeout(900);
  expect(await readAutosave(page)).not.toBeNull();
  await expect(page.locator('svg.canvas')).toBeVisible();
});

// ---------- вкладки и «Моя семья» ----------

const MF_KEY = 'family-studio:my-family:autosave:v1';
const readKey = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);
const tabs = (page: Page) => page.getByRole('navigation', { name: 'Инструменты' });

test('вкладки: «Моя семья» открыта первой, «Герб семьи» переключает, адрес и заголовок следуют, перезагрузка оставляет герб', async ({ page }) => {
  await page.goto('./');
  await expect(tabs(page)).toBeVisible();
  await expect(tabs(page).getByRole('button')).toHaveCount(2);
  await expect(tabs(page).getByRole('button').nth(0)).toHaveText('Моя семья');
  await expect(tabs(page).getByRole('button').nth(1)).toHaveText('Герб семьи');
  await expect(tabs(page).getByRole('button', { name: 'Моя семья' })).toHaveAttribute('aria-current', 'page');
  await expect(tabs(page).getByRole('button', { name: 'Герб семьи' })).not.toHaveAttribute('aria-current', 'page');
  await expect(page.locator('svg.mf-sheet')).toBeVisible();

  await tabs(page).getByRole('button', { name: 'Герб семьи' }).click();
  await expect(page.getByRole('button', { name: /Чистый лист/ })).toBeVisible();
  await expect(page).toHaveURL(/tool=crest/);
  await expect(page).toHaveTitle('Герб семьи — Студия семьи');
  await expect(tabs(page).getByRole('button', { name: 'Герб семьи' })).toHaveAttribute('aria-current', 'page');

  await page.reload();
  await expect(page.getByRole('button', { name: /Чистый лист/ })).toBeVisible();
  await expect(page.locator('svg.mf-sheet')).toHaveCount(0);
});

test('?only=my-family: вкладок нет, виден только лист', async ({ page }) => {
  await page.goto('./?only=my-family');
  await expect(page.locator('svg.mf-sheet')).toBeVisible();
  await expect(tabs(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Чистый лист/ })).toHaveCount(0);
});

test('«Стереть все мои данные» очищает оба инструмента и ничего не пишет обратно', async ({ page }) => {
  // The page clock is frozen after the first saves, so the 400 ms autosave timers of both tools are
  // certainly still pending when the wipe is clicked, and fire only when the test moves the clock on.
  await page.clock.install({ time: new Date('2026-03-01T10:00:00') });
  await page.goto('./');
  await page.getByRole('button', { name: 'Круг', exact: true }).click();
  await expect.poll(() => readKey(page, MF_KEY)).not.toBeNull();
  await tabs(page).getByRole('button', { name: 'Герб семьи' }).click();
  await startCrest(page);
  await expect.poll(() => readKey(page, AUTOSAVE_KEY)).not.toBeNull();

  await page.clock.pauseAt(new Date('2026-03-01T11:00:00'));
  // one more change in each tool: both autosaves are pending now, and nothing can fire them
  await page.getByRole('button', { name: 'Дуб', exact: true }).first().click();
  await tabs(page).getByRole('button', { name: 'Моя семья' }).click();
  await page.getByRole('button', { name: 'Квадрат', exact: true }).click();
  await page.clock.runFor(100); // lets the page draw (effects wait for a frame); the 400 ms timers are still pending
  await expect(page.locator('svg.mf-sheet [data-fig]')).toHaveCount(2);

  page.once('dialog', (d) => d.accept());
  await page.getByText('Данные', { exact: true }).click();
  await page.getByRole('button', { name: 'Стереть все мои данные' }).click();
  expect(await readKey(page, MF_KEY)).toBeNull();
  expect(await readKey(page, AUTOSAVE_KEY)).toBeNull();

  await page.clock.runFor(1000); // every timer that was pending now fires
  expect(await readKey(page, MF_KEY)).toBeNull();
  expect(await readKey(page, AUTOSAVE_KEY)).toBeNull();
  await expect(page.locator('svg.mf-sheet [data-fig]')).toHaveCount(0);
  await tabs(page).getByRole('button', { name: 'Герб семьи' }).click();
  await expect(page.getByRole('button', { name: /Чистый лист/ })).toBeVisible();
  await page.reload();
  expect(await readKey(page, MF_KEY)).toBeNull();
  expect(await readKey(page, AUTOSAVE_KEY)).toBeNull();
});
