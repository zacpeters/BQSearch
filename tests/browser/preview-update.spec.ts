import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { expect, test } from '@playwright/test';

test('loads the deployed preview shell online and the installed build offline', async ({ context, page }) => {
  const scope = '/BQSearch-Preview/';
  const contentTypes: Record<string, string> = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  };
  let revision = 'installed';
  let servedNavigations = 0;
  const server = createServer(async (request, response) => {
    const { pathname } = new URL(request.url!, 'http://localhost');
    if (!pathname.startsWith(scope)) {
      response.writeHead(404).end();
      return;
    }
    const file = pathname.slice(scope.length) || 'index.html';
    try {
      const content = await readFile(join('dist', file));
      const contentType = contentTypes[extname(file)] ?? 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
      if (file === 'index.html') {
        if (request.headers['sec-fetch-dest'] === 'document') servedNavigations++;
        response.end(content.toString().replace('<html lang="en">', `<html lang="en" data-preview-revision="${revision}">`));
      } else {
        response.end(content);
      }
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Preview fixture did not start.');
  const url = `http://127.0.0.1:${address.port}${scope}`;
  const appShell = page.locator('html');

  try {
    await page.addInitScript(() => localStorage.setItem('bq-search-walkthrough-v1', 'dismissed'));
    await page.goto(url);
    await expect(appShell).toHaveAttribute('data-preview-revision', 'installed');
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    expect(servedNavigations).toBe(1);

    // Simulate Pages replacing its HTML while the browser still controls the
    // page with the previously installed worker and its unchanged manifest.
    revision = 'deployed';
    await page.reload();
    await expect(appShell).toHaveAttribute('data-preview-revision', 'deployed');
    await page.goto(`${url}index.html`);
    await expect(appShell).toHaveAttribute('data-preview-revision', 'deployed');

    await context.setOffline(true);
    await page.reload();
    await expect(appShell).toHaveAttribute('data-preview-revision', 'installed');
    await page.getByRole('button', { name: 'Quizzes', exact: true }).click();
    await page.getByRole('button', { name: 'Generate Quiz', exact: true }).click();
    await expect(page.locator('.generator-type-picker')).toBeVisible();
    await expect(page.getByText('891 eligible questions', { exact: true })).toBeVisible();
  } finally {
    await context.setOffline(false);
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
