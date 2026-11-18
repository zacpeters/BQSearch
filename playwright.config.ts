import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testIgnore: '**/flag-off.spec.ts',
  fullyParallel: false,
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:4185/BQSearch-Preview/', channel: 'chrome', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'ipad', use: { ...devices['iPad (gen 7)'], browserName: 'chromium', channel: 'chrome' } },
  ],
  webServer: { command: 'VITE_ENABLE_QUIZZES=true VITE_BASE_PATH=/BQSearch-Preview/ npm run build && VITE_BASE_PATH=/BQSearch-Preview/ npm run preview -- --host 127.0.0.1 --port 4185 --strictPort', url: 'http://127.0.0.1:4185/BQSearch-Preview/', reuseExistingServer: false, timeout: 120_000 },
});
