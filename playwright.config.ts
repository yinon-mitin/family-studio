import { defineConfig, devices } from '@playwright/test';

// По умолчанию тесты идут против собранного сайта. Для быстрой отладки: E2E_BASE=http://localhost:5173/family-studio/ npm run e2e
const base = process.env.E2E_BASE ?? 'http://localhost:4173/family-studio/';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: base, trace: 'retain-on-failure' },
  webServer: process.env.E2E_BASE
    ? undefined
    : { command: 'npm run build && npx vite preview --port 4173 --strictPort', url: base, reuseExistingServer: true, timeout: 180_000 },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1360, height: 860 } } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    // WebKit нужны системные библиотеки; включается переменной E2E_WEBKIT=1
    ...(process.env.E2E_WEBKIT ? [{ name: 'desktop-webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1360, height: 860 } } }] : []),
  ],
});
