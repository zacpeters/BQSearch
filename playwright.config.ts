import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testIgnore: '**/flag-off.spec.ts',
  fullyParallel: false,
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:4185', channel: 'chrome', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'ipad', use: { ...devices['iPad (gen 7)'], browserName: 'chromium', channel: 'chrome' } },
  ],
  webServer: { command: 'VITE_ENABLE_QUIZZES=true npm run dev -- --host 127.0.0.1 --port 4185', url: 'http://127.0.0.1:4185', reuseExistingServer: false, timeout: 120_000 },
});
