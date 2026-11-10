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

/** «Данные → Стереть все мои данные» и ответ в собственном окне подтверждения. */
async function eraseAll(page: Page, answer: 'confirm' | 'cancel' | 'escape' = 'confirm') {
  await page.getByText('Данные', { exact: true }).click();
  await page.getByRole('button', { name: 'Стереть все мои данные' }).click();
  const dialog = page.getByRole('dialog', { name: 'Стереть все мои данные' });
  await expect(dialog).toBeVisible();
  if (answer === 'escape') {
    await expect(dialog).toBeFocused(); // the dialog has attached its keyboard handling by now
    await page.keyboard.press('Escape');
  } else {
    await dialog.getByRole('button', { name: answer === 'confirm' ? 'Стереть' : 'Отмена', exact: true }).click();
  }
  await expect(dialog).toHaveCount(0);
}

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
  await eraseAll(page);
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
  await eraseAll(page);
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
  await eraseAll(page, 'cancel');
  await page.waitForTimeout(900);
  expect(await readAutosave(page)).not.toBeNull();
  await expect(page.locator('svg.canvas')).toBeVisible();
});

test('отказ в подтверждении не трогает рисунок «Моей семьи» (кнопка и Escape)', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Круг', exact: true }).click();
  await expect.poll(() => readKey(page, MF_KEY)).not.toBeNull();
  await eraseAll(page, 'cancel');
  await eraseAll(page, 'escape');
  await page.waitForTimeout(900);
  expect(await readKey(page, MF_KEY)).not.toBeNull();
  await expect(page.locator('svg.mf-sheet [data-fig]')).toHaveCount(1);
  await expect(page.getByText('Данные стёрты')).toHaveCount(0);
});

test('стирание сообщает об успехе и работает без системных диалогов', async ({ page }) => {
  page.on('dialog', (d) => {
    throw new Error('the system dialog must not be used: ' + d.message());
  });
  await page.goto('./');
  await page.getByRole('button', { name: 'Круг', exact: true }).click();
  await expect.poll(() => readKey(page, MF_KEY)).not.toBeNull();
  await eraseAll(page);
  await expect(page.getByRole('status').filter({ hasText: 'Данные стёрты' })).toBeVisible();
  expect(await readKey(page, MF_KEY)).toBeNull();
});

test('стирание: язык тоже забывается, но интерфейс остаётся на выбранном языке', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'English' }).click();
  expect(await readKey(page, 'family-crest:lang')).toBe('en');
  await page.getByText('Data', { exact: true }).click();
  await page.getByRole('button', { name: 'Erase all my data' }).click();
  await page.getByRole('dialog', { name: 'Erase all my data' }).getByRole('button', { name: 'Erase', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Data erased' })).toBeVisible();
  expect(await readKey(page, 'family-crest:lang')).toBeNull();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('стирание: если хранилище не даёт удалить, показано, что именно не стёрто', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Круг', exact: true }).click();
  await expect.poll(() => readKey(page, MF_KEY)).not.toBeNull();
  await page.evaluate(() => {
    Storage.prototype.removeItem = () => {
      throw new Error('blocked');
    };
  });
  await eraseAll(page);
  const status = page.getByRole('status').filter({ hasText: 'Не удалось стереть данные' });
  await expect(status).toBeVisible();
  await expect(status).toContainText('Моя семья');
  await expect(status).toContainText('Герб семьи');
  await expect(page.getByText('Данные стёрты')).toHaveCount(0);
});

test('«Моя семья» открывается без ресурсов герба: ни значков, ни файлов шрифтов для контуров', async ({ page }) => {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(new URL(r.url()).pathname));
  await page.goto('./?only=my-family');
  await expect(page.locator('svg.mf-sheet')).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(urls.filter((u) => /symbols/.test(u))).toEqual([]);
  expect(urls.filter((u) => /\.woff$/.test(u))).toEqual([]); // the .woff files are read by the crest text outlines; the page itself uses woff2
});

test('сбой загрузки ресурсов герба виден только во вкладке герба', async ({ page }) => {
  await page.route(/symbols-.*\.js/, (route) => route.abort());
  await page.goto('./');
  await expect(page.locator('svg.mf-sheet')).toBeVisible();
  await tabs(page).getByRole('button', { name: 'Герб семьи' }).click();
  await expect(page.getByText('Не удалось загрузить ресурсы сайта')).toBeVisible();
  await tabs(page).getByRole('button', { name: 'Моя семья' }).click();
  await expect(page.locator('svg.mf-sheet')).toBeVisible();
  await expect(page.getByText('Не удалось загрузить ресурсы сайта')).toHaveCount(0);
});

const description = (page: Page) => page.locator('meta[name="description"]').getAttribute('content');

test('описание страницы: студия, и в исходном HTML, и после загрузки, и после смены языка', async ({ page }) => {
  const html = await (await page.request.get('./')).text();
  expect(html).toMatch(/<meta name="description" content="[^"]*Студи[^"]*"/);
  expect(html).not.toMatch(/Конструктор герба/);
  expect(html).toMatch(/<title>Студия семьи<\/title>/);
  expect(html).toContain('<meta name="referrer" content="no-referrer"');

  await page.goto('./');
  expect(await description(page)).toContain('Студия семьи');
  expect(await description(page)).toContain('Моя семья');
  await page.getByRole('button', { name: 'English' }).click();
  expect(await description(page)).toContain('Family Studio');
  expect(await description(page)).not.toMatch(/[А-Яа-я]/);
  await page.getByRole('navigation', { name: 'Tools' }).getByRole('button', { name: 'Family crest' }).click();
  expect(await description(page)).toContain('Family Studio'); // the same on every tool
  await page.getByRole('button', { name: 'Русский' }).click();
  expect(await description(page)).toContain('Студия семьи');
});

for (const [w, h] of [[360, 740], [412, 915], [844, 390]]) {
  test(`телефон ${w}x${h}: вкладки, «Данные» и язык не меньше 44 px, полоса не вылезает`, async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile-chromium', 'touch targets matter on phones');
    await page.setViewportSize({ width: w, height: h });
    for (const lang of ['ru', 'en']) {
      await page.goto(`./?lang=${lang}`);
      await expect(page.locator('svg.mf-sheet')).toBeVisible();
      const targets = page.locator('.shell-bar').locator('.shell-tabs button, summary, .lang-switch button');
      expect(await targets.count()).toBe(5);
      for (let i = 0; i < 5; i++) {
        const box = (await targets.nth(i).boundingBox())!;
        expect(box.height, `${lang} target ${i} height`).toBeGreaterThanOrEqual(44);
        expect(box.width, `${lang} target ${i} width`).toBeGreaterThanOrEqual(44);
        expect(box.x, `${lang} target ${i} left`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `${lang} target ${i} right`).toBeLessThanOrEqual(w);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(await page.evaluate(() => { const bar = document.querySelector('.shell-bar')!; return bar.scrollWidth <= bar.clientWidth; })).toBe(true);
    }
  });
}

test('меню «Данные» закрывается по Escape (фокус возвращается) и по щелчку снаружи', async ({ page }) => {
  await page.goto('./');
  const menu = page.locator('.shell-bar details.menu');
  const summary = menu.locator('summary');
  await summary.click();
  await expect(menu).toHaveAttribute('open', '');
  await page.keyboard.press('Escape');
  await expect(menu).not.toHaveAttribute('open', '');
  await expect(summary).toBeFocused();

  await summary.click();
  await expect(menu).toHaveAttribute('open', '');
  await page.locator('.shell-brand').click();
  await expect(menu).not.toHaveAttribute('open', '');

  await summary.click(); // a click inside the menu does not close it by itself
  await expect(menu).toHaveAttribute('open', '');
  await menu.getByRole('button', { name: 'Стереть все мои данные' }).click();
  await expect(page.getByRole('dialog', { name: 'Стереть все мои данные' })).toBeVisible();
  await expect(menu).not.toHaveAttribute('open', '');
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

  await eraseAll(page);
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
