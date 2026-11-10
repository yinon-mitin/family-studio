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

/** Чистый лист с одним символом; ждёт, пока автосохранение (400 мс) ляжет в localStorage. */
async function crestWithAutosave(page: Page) {
  await page.goto('./?tool=crest');
  await page.getByRole('button', { name: /Чистый лист/ }).click();
  await expect(page.locator('svg.canvas')).toBeVisible();
  if ((page.viewportSize()?.width ?? 1000) <= 900) await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await page.getByRole('tab', { name: 'Символы' }).click();
  await page.getByLabel('Поиск символов').fill('Дуб');
  await page.getByRole('button', { name: 'Дуб', exact: true }).first().click();
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

test('отказ в подтверждении ничего не стирает', async ({ page }) => {
  await crestWithAutosave(page);
  page.once('dialog', (d) => d.dismiss());
  await page.getByText('Данные', { exact: true }).click();
  await page.getByRole('button', { name: 'Стереть все мои данные' }).click();
  await page.waitForTimeout(900);
  expect(await readAutosave(page)).not.toBeNull();
  await expect(page.locator('svg.canvas')).toBeVisible();
});
