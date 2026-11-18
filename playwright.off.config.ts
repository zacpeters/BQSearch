import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: /flag-off\.spec\.ts/,
  use: { baseURL: 'http://127.0.0.1:4186', channel: 'chrome', ...devices['Desktop Chrome'] },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4186', url: 'http://127.0.0.1:4186', reuseExistingServer: false, timeout: 120_000 },
});
