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
  await expect(page.locator('.collection-card')).toHaveCount(2);
  const powers = page.getByRole('button', { name: /BQ Powers.*25 quizzes.*500 questions/ });
  const liftUp = page.getByRole('button', { name: /Lift Up.*20 quizzes.*400 questions/ });
  await expect(liftUp).toBeVisible();
  await powers.click();
  await expect(page.locator('.quiz-row')).toHaveCount(25);
  await page.locator('.quiz-row').first().click();
  await expect(page.locator('.practice-question')).toHaveCount(20);
  await expect(page.locator('.practice-question-text').first()).toHaveText(approved.questions[0].rawQuestion);
  await expect(page.locator('.answer-line p').first()).toHaveText(approved.questions[0].rawAnswer);
  await page.getByRole('region', { name: 'Practice quiz' }).getByRole('button', { name: /Library/ }).click();
  await page.getByRole('button', { name: 'Question Bank' }).click();
  await expect(page.getByText('900 matching', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Generate Quiz', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /BQ Powers · 2027/ })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /Lift Up · 2027/ })).toBeChecked();
  await expect(page.locator('.generator-availability > strong')).toHaveText(/^[1-9]\d* eligible questions$/);
  await page.locator('.generator-button').click();
  await expect(page.getByRole('button', { name: 'Save generated quiz' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Save generated quiz' })).toBeVisible();
  await expect.poll(() => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const cacheNames = await caches.keys();
    const urls = (await Promise.all(cacheNames.map(async key => (await (await caches.open(key)).keys()).map(request => request.url)))).flat();
    return Boolean(navigator.serviceWorker.controller && registration.scope.endsWith('/BQSearch-Preview/') && urls.some(url => /\/BQSearch-Preview\/assets\/bqquiz-2027-[\w-]+\.json/.test(url)));
  })).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Save generated quiz' })).toBeVisible();
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await expect(powers).toBeVisible();
  await expect(liftUp).toBeVisible();
  await expect(page.locator('.collection-card')).toHaveCount(2);
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
  await expect(page.locator('.collection-card')).toHaveCount(3);
  await expect(page.getByRole('heading', { name: 'Collections' })).toBeVisible();
  await page.getByRole('button', { name: 'Question Bank' }).click();
  await page.getByLabel('Collection filter').selectOption('synthetic-collection');
  await page.getByLabel('Search questions').fill('second');
  await page.locator('.bank-item').first().locator('summary').click();
  await expect(page.getByText('Synthetic answer two')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Questions', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await expect(page.getByRole('button', { name: /Synthetic Collection/ })).toBeVisible();
});

test('creates a user collection/question and uses the generator controls', async ({ page }) => {
  await page.getByRole('button', { name: 'Quizzes' }).click();
  await page.getByRole('button', { name: 'Question Bank' }).click();
  const createAnswers = ['My Collection', 'Personal', '2027'];
  const createPrompt = (dialog: import('@playwright/test').Dialog) => void dialog.accept(createAnswers.shift());
  page.on('dialog', createPrompt);
  await page.getByRole('button', { name: 'New collection' }).click();
  await expect(page.locator('.collection-tools > span').filter({ hasText: 'My Collection' })).toBeVisible();
  page.off('dialog', createPrompt);
  await page.getByRole('button', { name: 'Add question' }).click();
  await page.getByLabel('Question collection').selectOption({ label: 'My Collection' });
  await page.getByLabel('Question text').fill('My local question');
  await page.getByLabel('Answer text').fill('My local answer');
  await page.locator('.editor-panel').getByRole('button', { name: 'Add question' }).click();
  await page.getByLabel('Search questions').fill('My local question');
  await expect(page.getByText('1 matching', { exact: true })).toBeVisible();
  await page.locator('.question-bank-v5 .bank-actions input[type=file]').setInputFiles(importFixture);
  await expect(page.getByText('Import preview', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Commit import' }).click();
  await expect(page.getByText(/Imported 1 user questions/)).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const exported = await download;
  const exportPath = await exported.path();
  expect(JSON.parse(readFileSync(exportPath, 'utf8'))).toMatchObject({
    schemaVersion: 1,
    collections: expect.arrayContaining([expect.objectContaining({ name: 'My Collection' })]),
    questions: expect.arrayContaining([expect.objectContaining({ rawQuestion: 'My local question' })]),
  });
  await page.getByRole('button', { name: 'Generate Quiz' }).click();
  await expect(page.getByRole('heading', { name: 'Generate quiz' })).toBeVisible();
  await expect(page.getByLabel('Start Verse', { exact: true })).toBeVisible();
  await expect(page.getByLabel('End Verse', { exact: true })).toBeVisible();
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
  await expect(page.locator('.collection-card')).toHaveCount(3);
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

test('keeps V5 user edits separate from the published catalog and skips conflicting imports', async ({ page }) => {
  await page.getByRole('button', { name: 'Quizzes' }).click();
  await page.getByRole('button', { name: 'Question Bank' }).click();
  const bank = page.locator('.question-bank-v5');
  const published = approved.questions[0];
  const publishedRow = bank.locator('.bank-item').filter({ hasText: published.rawQuestion }).first();
  await publishedRow.locator('summary').click();
  await expect(publishedRow.getByText(published.rawAnswer, { exact: false })).toBeVisible();
  await expect(publishedRow.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  const collection = { id: 'v5-custom', name: 'V5 source collection', publisher: 'Synthetic source', year: 2027 };
  const question = { id: 'v5-custom-1', collectionId: collection.id, rawQuestion: 'V5 custom question', rawAnswer: 'V5 original answer', pointValue: 20, references: [{ book: 'Psalms', chapter: 3, startVerse: 1 }] };
  const upload = (value: unknown) => bank.locator('input[type=file]').setInputFiles({ name: 'v5-fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
  await upload({ schemaVersion: 1, collections: [collection, approved.collections[0]], questions: [question, { ...question, id: 'reserved-v5', collectionId: published.collectionId }] });
  await expect(bank.getByText('Existing or published IDs will be skipped: 2')).toBeVisible();
  await bank.getByRole('button', { name: 'Commit import' }).click();
  await expect(bank.getByText('Imported 1 user questions and 1 collections.')).toBeVisible();
  const collectionTools = bank.locator('.collection-tools > span').filter({ hasText: collection.name });
  const editAnswers = ['V5 edited collection', 'Synthetic edited publisher', '2028'];
  const collectionPrompt = (dialog: import('@playwright/test').Dialog) => void dialog.accept(editAnswers.shift());
  page.on('dialog', collectionPrompt);
  await collectionTools.getByRole('button', { name: 'Edit' }).click();
  await expect(bank.locator('.collection-tools > span').filter({ hasText: 'V5 edited collection' })).toBeVisible();
  page.off('dialog', collectionPrompt);

  await bank.getByLabel('Collection filter').selectOption(collection.id);
  const row = bank.locator('.bank-item').filter({ hasText: question.rawQuestion });
  await row.locator('summary').click();
  await row.getByRole('button', { name: 'Edit' }).click();
  await bank.getByLabel('Answer text').fill('V5 edited answer');
  await bank.getByLabel('Scripture references').fill('Psalm 3:1–2');
  await bank.getByRole('button', { name: 'Save question' }).click();
  await expect(row.getByText('V5 edited answer', { exact: false })).toBeVisible();
  await expect(row.getByText('Psalms 3:1–2', { exact: false })).toBeVisible();
  await row.getByRole('button', { name: 'Duplicate' }).click();
  await expect(row).toHaveCount(2);

  const download = page.waitForEvent('download');
  await bank.getByRole('button', { name: 'Export', exact: true }).click();
  const exported = JSON.parse(readFileSync(await (await download).path(), 'utf8'));
  expect(exported.collections).toEqual([expect.objectContaining({ id: collection.id, name: 'V5 edited collection', year: 2028 })]);
  expect(exported.questions).toHaveLength(2);
  expect(exported.questions).toContainEqual(expect.objectContaining({ id: question.id, rawAnswer: 'V5 edited answer' }));

  await upload({ schemaVersion: 1, collections: [collection], questions: [question] });
  await expect(bank.getByText('Existing or published IDs will be skipped: 2')).toBeVisible();
  await bank.getByRole('button', { name: 'Commit import' }).click();
  await expect(bank.getByText('Imported 0 user questions and 0 collections.')).toBeVisible();
  await expect(row).toHaveCount(2);
  page.once('dialog', dialog => dialog.accept());
  await bank.locator('.collection-tools > span').filter({ hasText: 'V5 edited collection' }).getByRole('button', { name: 'Delete' }).click();
  await expect(row).toHaveCount(0);
  await expect(bank.locator('.bank-item')).toHaveCount(900);
});
