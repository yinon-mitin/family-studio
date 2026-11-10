import { expect, test } from '@playwright/test';

test('оболочка: полоса с названием и один переключатель языка над гербом', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText('Студия семьи', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Студия семьи' })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Язык' })).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Герб семьи' })).toBeVisible();
  await expect(page).toHaveTitle('Герб семьи — Студия семьи');
});

test('английский: название вкладки и оболочки', async ({ page }) => {
  await page.goto('./');
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
  await page.goto('./');
  await page.getByRole('button', { name: /Чистый лист/ }).click();
  const canvas = page.locator('svg.canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  const height = page.viewportSize()!.height;
  expect(box!.y + box!.height).toBeLessThanOrEqual(height);
});
