import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { QuizDataSnapshot } from '../../src/integration/contracts';

const fixtures: { original: QuizDataSnapshot; integration: QuizDataSnapshot } = JSON.parse(
  readFileSync('tests/fixtures/bqquiz-parity-storage.json', 'utf8'),
);

async function quizStorage(page: Page, seed?: typeof fixtures) {
  return page.evaluate(async seed => {
    const indexes = {
      sessions: ['by-quiz', 'quizId'],
      customQuizzes: ['by-updated', 'updatedAt'],
      coveragePresets: ['by-updated', 'updatedAt'],
      userCollections: ['by-updated', 'updatedAt'],
      userQuestions: ['by-collection', 'collectionId'],
    } as const;
    const stores = Object.keys(indexes) as (keyof QuizDataSnapshot)[];
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('bqquiz-local', 3);
      request.onupgradeneeded = () => {
        for (const store of stores) {
          const [index, keyPath] = indexes[store];
          request.result.createObjectStore(store, { keyPath: 'id' }).createIndex(index, keyPath);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      if (seed) await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(stores, 'readwrite');
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error);
        for (const store of stores) {
          for (const record of [...seed.original[store], ...seed.integration[store]]) transaction.objectStore(store).add(record);
        }
      });
      const results = await Promise.all(stores.map(store => new Promise<[string, unknown[]]>((resolve, reject) => {
        const request = db.transaction(store).objectStore(store).getAll();
        request.onsuccess = () => resolve([store, request.result]);
        request.onerror = () => reject(request.error);
      })));
      return Object.fromEntries(results) as QuizDataSnapshot;
    } finally {
      db.close();
    }
  }, seed);
}

async function hostStyles(page: Page, selector: string) {
  return page.evaluate(selector => [document.body, document.querySelector('.app-toolbar'), document.querySelector(selector)].map(node => {
    const style = getComputedStyle(node!);
    return [style.backgroundColor, style.color, style.fontFamily, style.getPropertyValue('--line'), node!.getBoundingClientRect().width];
  }), selector);
}

test('shows the original shell geometry and isolates quiz theme, host tools, and stored data', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'desktop') await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => localStorage.setItem('bq-search-walkthrough-v1', 'dismissed'));
  await page.goto('./');
  const lookup = page.getByRole('textbox', { name: 'Search Scripture' });
  await lookup.fill('Psalm 3:1');
  const lookupStyles = await hostStyles(page, '.search-line');
  await page.getByRole('button', { name: 'Score Sheet' }).click();
  await page.getByRole('button', { name: 'Start scoring' }).click();
  await page.getByRole('textbox', { name: 'red team name' }).fill('Synthetic shell test team');
  const scoreStyles = await hostStyles(page, '.scorer-view');
  const before = await quizStorage(page, fixtures);

  await page.getByRole('button', { name: 'Quizzes', exact: true }).click();
  const frame = page.getByRole('region', { name: 'BQQuiz', exact: true });
  const header = frame.locator('.app-header');
  const nav = frame.getByRole('navigation', { name: 'BQQuiz navigation' });
  await expect(nav.getByRole('button')).toHaveText(['Library', 'Question Bank', 'Generate Quiz']);
  await expect(nav.getByRole('button', { name: 'Library' })).toHaveAttribute('aria-current', 'page');
  await expect(frame.locator('.quiz-collection-card')).toHaveCount(2);
  await expect(frame.getByText('2027 selected Psalms · 900 imported questions')).toBeVisible();
  await expect(header).toHaveCSS('height', '76px');
  const compact = page.viewportSize()!.width <= 850;
  await expect(header).toHaveCSS('padding-left', compact ? '18px' : '40px');
  await expect(header).toHaveCSS('column-gap', compact ? '15px' : '42px');
  await expect(header.locator('.status-chip')).toHaveCSS('display', compact ? 'none' : 'block');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => innerWidth));
  await page.screenshot({ path: testInfo.outputPath('shell-light.png'), animations: 'disabled' });

  const theme = frame.getByRole('button', { name: 'Toggle dark mode' });
  await theme.click();
  await expect(theme).toHaveAttribute('aria-pressed', 'true');
  await expect(frame).toHaveCSS('background-color', 'rgb(22, 26, 31)');
  await expect(frame.locator('.quiz-collection-card').first()).toHaveCSS('background-color', 'rgb(32, 37, 43)');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.screenshot({ path: testInfo.outputPath('shell-dark.png'), animations: 'disabled' });

  await frame.getByRole('button', { name: 'Saved Quizzes', exact: true }).click();
  await expect(frame.getByText('Saved shell fixture (original)', { exact: true })).toBeVisible();
  await expect(frame.getByText('Saved shell fixture (integration)', { exact: true })).toBeVisible();
  await nav.getByRole('button', { name: 'Question Bank' }).click();
  await expect(frame.getByText('904 matching', { exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 500));
  await expect.poll(() => header.evaluate(node => node.getBoundingClientRect().top)).toBe(52);
  await nav.getByRole('button', { name: 'Generate Quiz' }).click();
  await expect(frame.getByRole('heading', { name: 'Generate quiz', exact: true })).toBeVisible();
  await frame.getByRole('button', { name: 'BQQuiz Library' }).click();
  await expect(frame.getByRole('heading', { name: 'Collections' })).toBeVisible();
  expect(await quizStorage(page)).toEqual(before);

  await page.getByRole('button', { name: 'Go to BQ Search lookup' }).click();
  await expect(lookup).toHaveValue('Psalm 3:1');
  expect(await hostStyles(page, '.search-line')).toEqual(lookupStyles);
  await expect(frame).toHaveCount(0);
  await page.getByRole('button', { name: 'Score Sheet' }).click();
  await expect(page.getByRole('textbox', { name: 'red team name' })).toHaveValue('Synthetic shell test team');
  expect(await hostStyles(page, '.scorer-view')).toEqual(scoreStyles);
});
