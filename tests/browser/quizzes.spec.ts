import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { QuizCatalog } from '../../src/features/quizzes/types';

const fixture = path.resolve('tests/fixtures/synthetic-catalog.json');
const importFixture = path.resolve('tests/fixtures/user-import.csv');
type CatalogFile = Pick<QuizCatalog, 'schemaVersion' | 'sourceSet' | 'collections' | 'quizzes' | 'questions'>;
const approved: CatalogFile = JSON.parse(readFileSync('src/features/quizzes/catalog/bqquiz-2027.json', 'utf8'));
const synthetic: CatalogFile = JSON.parse(readFileSync(fixture, 'utf8'));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bq-search-walkthrough-v1', 'dismissed'));
  await page.goto('./');
});

test.describe('catalog fallback', () => {
  test.use({ serviceWorkers: 'block' });

  test('keeps manual catalog installation available when the bundle fails', async ({ page }) => {
    await page.route(/\/assets\/bqquiz-2027-[\w-]+\.json$/, route => route.abort());
    await page.getByRole('button', { name: 'Quizzes' }).click();
    await expect(page.getByText('No published catalog is available.')).toBeVisible();
    await page.getByLabel('Advanced catalog options', { exact: true }).click();
    await page.locator('.quiz-catalog-options input[type=file]').setInputFiles(fixture);
    await expect(page.getByRole('button', { name: /Synthetic Collection/ })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Quiz sections' })).toBeVisible();
  });
});

test('opens the public Library, Question Bank and Generator on a fresh visit and offline', async ({ page, context }) => {
  await page.getByRole('button', { name: 'Quizzes' }).click();
  await expect(page.locator('.quiz-collection-card')).toHaveCount(2);
  await expect(page.getByText('2 collections · 45 quizzes')).toBeVisible();
  const powers = page.getByRole('button', { name: /BQ Powers.*25 quizzes.*500 questions/ });
  const liftUp = page.getByRole('button', { name: /Lift Up.*20 quizzes.*400 questions/ });
  await expect(liftUp).toBeVisible();
  await powers.click();
  await expect(page.locator('.quiz-row')).toHaveCount(25);
  await page.locator('.quiz-row').first().click();
  await expect(page.locator('.quiz-question-card')).toHaveCount(20);
  await page.locator('.quiz-question-card summary').first().click();
  await expect(page.locator('.quiz-question-card').first()).toContainText(approved.questions[0].rawQuestion);
  await expect(page.locator('.quiz-question-card').first()).toContainText(approved.questions[0].rawAnswer);
  await page.getByRole('button', { name: 'Question Bank' }).click();
  await expect(page.getByText('900 matching', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Generate Quiz', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /BQ Powers · 2027/ })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /Lift Up · 2027/ })).toBeChecked();
  await expect(page.locator('.generator-availability > strong')).toHaveText(/^[1-9]\d* eligible questions$/);
  await page.locator('.generator-button').click();
  await expect(page.getByRole('button', { name: 'Save generated quiz' })).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Quizzes' }).click();
  await expect(page.locator('.quiz-collection-card')).toHaveCount(2);
  await expect.poll(() => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const cacheNames = await caches.keys();
    const urls = (await Promise.all(cacheNames.map(async key => (await (await caches.open(key)).keys()).map(request => request.url)))).flat();
    return Boolean(navigator.serviceWorker.controller && registration.scope.endsWith('/BQSearch-Preview/') && urls.some(url => /\/BQSearch-Preview\/assets\/bqquiz-2027-[\w-]+\.json/.test(url)));
  })).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Quizzes' }).click();
  await expect(powers).toBeVisible();
  await expect(liftUp).toBeVisible();
  await expect(page.locator('.quiz-collection-card')).toHaveCount(2);
});

test('installs a local catalog and persists Library/Question Bank state', async ({ page }) => {
  await page.getByRole('button', { name: 'Quizzes' }).click();
  await page.getByLabel('Advanced catalog options', { exact: true }).click();
  await page.getByRole('button', { name: 'Install local catalog' }).click();
  const file = page.locator('.quiz-catalog-options input[type=file]');
  await page.getByLabel('Expected catalog SHA-256').fill('0'.repeat(64));
  await file.setInputFiles(fixture);
  await expect(page.getByRole('status')).toContainText('Catalog digest mismatch');
  await page.getByLabel('Expected catalog SHA-256').clear();
  await file.setInputFiles(fixture);
  await expect(page.getByRole('status')).toContainText('Installed Synthetic local catalog locally');
  await expect(page.locator('.quiz-collection-card')).toHaveCount(3);
  await expect(page.getByRole('heading', { name: 'Collections' })).toBeVisible();
  await page.getByRole('button', { name: 'Question Bank' }).click();
  await page.getByLabel('Collection filter').selectOption('synthetic-collection');
  await page.getByLabel('Search questions').fill('second');
  await page.locator('.question-bank-item').first().locator('summary').click();
  await expect(page.getByText('Synthetic answer two')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Quizzes' }).click();
  await expect(page.getByRole('button', { name: /Synthetic Collection/ })).toBeVisible();
});

test('creates a user collection/question and uses the generator controls', async ({ page }) => {
  await page.getByRole('button', { name: 'Quizzes' }).click();
  await page.getByRole('button', { name: 'Question Bank' }).click();
  page.once('dialog', dialog => dialog.accept('My Collection'));
  await page.getByRole('button', { name: 'New collection' }).click();
  await expect(page.locator('.user-collection-strip span').filter({ hasText: 'My Collection' })).toBeVisible();
  await page.getByRole('button', { name: 'Add question' }).click();
  await page.getByLabel('Question collection').selectOption({ label: 'My Collection' });
  await page.getByLabel('Question text').fill('My local question');
  await page.getByLabel('Answer text').fill('My local answer');
  await page.getByRole('button', { name: 'Save question' }).click();
  await page.getByLabel('Search questions').fill('My local question');
  await expect(page.getByText('1 matching', { exact: true })).toBeVisible();
  await page.locator('.quiz-page .quiz-actions input[type=file]').setInputFiles(importFixture);
  await expect(page.getByText('Import preview', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Commit import' }).click();
  await expect(page.getByText(/Imported 1 user questions/)).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export user data' }).click();
  await expect(download).resolves.toBeTruthy();
  await page.getByRole('button', { name: 'Generate Quiz' }).click();
  await expect(page.getByRole('heading', { name: 'Generate quiz' })).toBeVisible();
  await expect(page.getByLabel('Start Verse')).toBeVisible();
  await expect(page.getByLabel('End Verse')).toBeVisible();
  await page.getByLabel('Default distribution').uncheck();
  await page.getByLabel('10-point questions').fill('1');
  await page.getByLabel('20-point questions').fill('0');
  await page.getByLabel('30-point questions').fill('0');
  await page.locator('.generator-button').click();
  await expect(page.getByText('Preview', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save generated quiz' }).click();
  await expect(page.getByRole('region', { name: 'Saved quizzes' })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Collections' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Quizzes' }).click();
  await expect(page.getByRole('heading', { name: 'Saved quizzes' })).toBeVisible();
  await expect(page.getByText('Generated quiz', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Question Bank' }).click();
  await expect(page.getByLabel('Collection filter').locator('option').filter({ hasText: 'Personal · My Collection' })).toHaveCount(1);
  await page.getByLabel('Search questions').fill('My local question');
  await expect(page.getByText('1 matching', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Go to BQ Search lookup/ }).click();
  await expect(page.getByRole('textbox', { name: 'Search Scripture' })).toBeVisible();
});

test('upgrades overlapping published data while preserving installed catalogs', async ({ page }) => {
  const old = {
    ...approved,
    collections: [{ ...approved.collections[0], quizIds: [approved.quizzes[0].id] }],
    quizzes: [{ ...approved.quizzes[0], questionIds: [approved.questions[0].id] }],
    questions: [{ ...approved.questions[0], rawQuestion: 'Locally installed older wording' }],
    catalogId: approved.sourceSet.id,
    catalogVersion: 'legacy-version',
    installedAt: '2026-01-01T00:00:00Z',
  };
  await page.evaluate(async catalogs => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('bqsearch-quizzes', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('published-catalogs', { keyPath: 'catalogId' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('published-catalogs', 'readwrite');
        for (const catalog of catalogs) transaction.objectStore('published-catalogs').put(catalog);
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error);
      });
    } finally { db.close(); }
  }, [old, { ...synthetic, catalogId: synthetic.sourceSet.id, catalogVersion: 'local-version', installedAt: '2026-01-02T00:00:00Z' }]);
  await page.getByRole('button', { name: 'Quizzes' }).click();
  await expect(page.locator('.quiz-collection-card')).toHaveCount(3);
  await expect(page.getByText('3 collections · 46 quizzes')).toBeVisible();
  await page.getByRole('button', { name: 'Question Bank' }).click();
  await expect(page.getByText('903 matching', { exact: true })).toBeVisible();
  await page.getByLabel('Search questions').fill('Locally installed older wording');
  await expect(page.getByText('0 matching', { exact: true })).toBeVisible();
  const legacyCatalog = await page.evaluate(async id => new Promise((resolve, reject) => {
    const request = indexedDB.open('bqsearch-quizzes', 1);
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction('published-catalogs').objectStore('published-catalogs').get(id);
      read.onsuccess = () => { db.close(); resolve(read.result); };
      read.onerror = () => { db.close(); reject(read.error); };
    };
    request.onerror = () => reject(request.error);
  }), old.catalogId);
  expect(legacyCatalog).toEqual(old);
});
