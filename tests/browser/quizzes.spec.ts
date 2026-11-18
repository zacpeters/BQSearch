import { test, expect } from '@playwright/test';
import path from 'node:path';

const fixture = path.resolve('tests/fixtures/synthetic-catalog.json');
const importFixture = path.resolve('tests/fixtures/user-import.csv');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    for (const name of await indexedDB.databases()) indexedDB.deleteDatabase(name.name!);
    localStorage.setItem('bq-search-walkthrough-v1', 'dismissed');
  });
  await page.reload();
});

test('installs a local catalog and persists Library/Question Bank state', async ({ page }) => {
  await page.getByRole('button', { name: 'Quizzes' }).click();
  await page.getByRole('button', { name: 'Install local catalog' }).click();
  await page.locator('input[type=file]').setInputFiles(fixture);
  await expect(page.locator('.quiz-nav strong')).toHaveText('Synthetic local catalog');
  await expect(page.getByRole('heading', { name: 'Collections' })).toBeVisible();
  await page.getByRole('button', { name: 'Question Bank' }).click();
  await page.getByLabel('Search questions').fill('second');
  await page.locator('.question-bank-item').first().locator('summary').click();
  await expect(page.getByText('Synthetic answer two')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Quizzes' }).click();
  await expect(page.locator('.quiz-nav strong')).toHaveText('Synthetic local catalog');
});

test('creates a user collection/question and uses the generator controls', async ({ page }) => {
  await page.getByRole('button', { name: 'Quizzes' }).click();
  await page.getByRole('button', { name: 'Install local catalog' }).click();
  await page.locator('input[type=file]').setInputFiles(fixture);
  await page.getByRole('button', { name: 'Question Bank' }).click();
  page.once('dialog', dialog => dialog.accept('My Collection'));
  await page.getByRole('button', { name: 'New collection' }).click();
  await expect(page.locator('.user-collection-strip span').filter({ hasText: 'My Collection' })).toBeVisible();
  await page.getByRole('button', { name: 'Add question' }).click();
  await page.getByLabel('Question collection').selectOption({ label: 'My Collection' });
  await page.getByLabel('Question text').fill('My local question');
  await page.getByLabel('Answer text').fill('My local answer');
  await page.getByRole('button', { name: 'Save question' }).click();
  await expect(page.getByText('My local question')).toBeVisible();
  await page.locator('.quiz-actions input[type=file]').setInputFiles(importFixture);
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
  await expect(page.getByRole('heading', { name: 'Saved quizzes' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Quizzes' }).click();
  await page.getByRole('button', { name: 'Saved Quizzes' }).click();
  await expect(page.getByRole('heading', { name: 'Saved quizzes' })).toBeVisible();
  await page.getByRole('button', { name: 'Lookup', exact: true }).click();
  await expect(page.getByRole('button', { name: /Go to BQ Search lookup/ })).toBeVisible();
});
