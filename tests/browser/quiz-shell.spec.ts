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

test('uses unified quiz navigation and theme while preserving host tools and all five stores', async ({ page }, testInfo) => {
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
  const frame = page.getByRole('region', { name: 'Quizzes', exact: true });
  const nav = frame.getByRole('navigation', { name: 'Quiz sections' });
  await expect(nav.getByRole('button')).toHaveText(['Library', 'Question Bank', 'Generate Quiz']);
  await expect(nav.getByRole('button', { name: 'Library' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('header')).toHaveCount(1);
  await expect(frame.locator('footer')).toHaveCount(0);
  await expect(frame.getByRole('button', { name: 'Back to Lookup' })).toHaveCount(0);
  await expect(frame.getByRole('button', { name: 'Install local catalog' })).toBeHidden();
  await expect(frame.locator('.collection-card')).toHaveCount(4);
  const saved = frame.getByRole('region', { name: 'Saved quizzes' });
  await expect(saved.getByText('Saved shell fixture (original)', { exact: true })).toBeVisible();
  await expect(saved.getByText('Saved shell fixture (integration)', { exact: true })).toBeVisible();
  await expect(saved).not.toContainText('undefined');
  if (page.viewportSize()!.width <= 700) await expect(nav.getByRole('button').first()).toHaveCSS('min-height', '36px');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => innerWidth));
  await page.screenshot({ path: testInfo.outputPath('shell-light.png'), animations: 'disabled' });

  await page.getByRole('button', { name: 'Use dark mode', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(frame.locator('.collection-card').first()).toHaveCSS('background-color', 'rgb(29, 32, 36)');
  await page.screenshot({ path: testInfo.outputPath('shell-dark.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Use light mode', exact: true }).click();
  const cards = frame.locator('.collection-cards');
  const gridColumns = page.viewportSize()!.width <= 850 ? 1 : 3;
  expect(await cards.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length)).toBe(gridColumns);

  await saved.getByRole('button', { name: /Saved shell fixture \(original\)/ }).click();
  await expect(frame.getByRole('heading', { name: 'Saved shell fixture (original)' })).toBeVisible();
  await frame.locator('.quiz-question-card summary').first().click();
  await expect(frame.locator('.quiz-question-card').first()).toContainText('Synthetic question 2');
  await frame.getByRole('button', { name: '‹ Collections' }).click();
  await frame.getByRole('button', { name: /BQ Powers.*25 quizzes/ }).click();
  await expect(frame.locator('.quiz-row')).toHaveCount(25);
  await expect(frame.locator('.quiz-row').first()).toContainText('Psalms 3:1–5:12');
  await page.screenshot({ path: testInfo.outputPath('library-drilldown.png'), animations: 'disabled' });

  await nav.getByRole('button', { name: 'Question Bank' }).click();
  await expect(frame.getByText('904 matching', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('question-bank.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Use dark mode', exact: true }).click();
  await expect(frame.getByRole('button', { name: 'New collection' })).toHaveCSS('color', 'rgb(238, 241, 244)');
  await page.evaluate(() => window.scrollTo(0, 500));
  await expect.poll(() => page.locator('.app-toolbar').evaluate(node => node.getBoundingClientRect().top)).toBe(0);
  await nav.getByRole('button', { name: 'Generate Quiz' }).click();
  await expect(frame.getByRole('heading', { name: 'Generate quiz', exact: true })).toBeVisible();
  await nav.getByRole('button', { name: 'Library' }).click();
  await expect(frame.getByRole('heading', { name: 'Collections' })).toBeVisible();
  expect(await quizStorage(page)).toEqual(before);

  await page.getByRole('button', { name: 'Go to BQ Search lookup' }).click();
  await expect(lookup).toHaveValue('Psalm 3:1');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Use light mode', exact: true }).click();
  expect(await hostStyles(page, '.search-line')).toEqual(lookupStyles);
  await expect(frame).toHaveCount(0);
  await page.getByRole('button', { name: 'Score Sheet' }).click();
  await expect(page.getByRole('textbox', { name: 'red team name' })).toHaveValue('Synthetic shell test team');
  expect(await hostStyles(page, '.scorer-view')).toEqual(scoreStyles);
  await page.reload();
  expect(await quizStorage(page)).toEqual(before);
});
