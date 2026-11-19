import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { PracticeSession } from '../../src/features/quizzes/practice/practice';
import type { QuizDataSnapshot } from '../../src/integration/contracts';

const saveFixture: QuizDataSnapshot = JSON.parse(readFileSync('tests/fixtures/bqquiz-parity-storage.json', 'utf8')).original;
const publishedId = 'bq-powers-2027-quiz-01';

async function sessions(page: Page): Promise<PracticeSession[]> {
  return page.evaluate(async quizId => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('bqquiz-local', 3);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const read = db.transaction('sessions').objectStore('sessions').index('by-quiz').getAll(quizId);
        read.onsuccess = () => resolve(read.result);
        read.onerror = () => reject(read.error);
      });
    } finally { db.close(); }
  }, publishedId);
}

async function openPublished(page: Page) {
  await page.getByRole('button', { name: /BQ Powers.*25 quizzes/ }).click();
  await page.locator('.quiz-row').first().click();
  const practice = page.getByRole('region', { name: 'Practice quiz' });
  await expect(practice.locator('.practice-question')).toHaveCount(20);
  return practice;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bq-search-walkthrough-v1', 'dismissed'));
  await page.goto('./');
});

test('records, reviews, prints, resumes, and resets V5 Practice while keeping history', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Ending verse').selectOption('1');
  await page.getByRole('button', { name: 'Quizzes' }).click();
  let practice = await openPublished(page);
  const first = practice.locator('.practice-question').first();
  const red = first.getByRole('group', { name: 'Red team' });
  const yellow = first.getByRole('group', { name: 'Yellow team' });
  const activity = practice.getByRole('complementary', { name: 'Practice activity' });
  await first.getByRole('button', { name: 'Psalms 5:12', exact: true }).click();
  const drawer = practice.getByRole('complementary', { name: 'Scripture reference' });
  await expect(drawer.locator('.scripture-text')).toContainText(/bless the righteous/i);
  await drawer.getByRole('button', { name: 'Close Scripture reference' }).click();

  await expect(red.getByRole('button', { name: 'E', exact: true })).toBeDisabled();
  await red.getByRole('button', { name: 'red interruption' }).click();
  await first.locator('.tap-word').nth(1).click();
  await expect(first.locator('.screen-slash')).toBeVisible();
  await red.getByRole('button', { name: 'R1', exact: true }).click();
  await red.getByRole('button', { name: 'E', exact: true }).click();
  await expect(first.getByText('Reread for Yellow')).toBeVisible();
  await expect(first.locator('.screen-slash')).toHaveCount(0);
  await expect(red.getByRole('button', { name: 'R1', exact: true })).toBeDisabled();
  await expect(yellow.getByRole('button', { name: 'Y1', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await yellow.getByRole('button', { name: 'Y1', exact: true }).click();
  await yellow.getByRole('button', { name: 'C', exact: true }).click();
  await expect(activity.locator('.log-entry')).toHaveCount(2);
  await expect(activity.locator('.log-entry').first()).toContainText('Y1');
  await activity.getByRole('button', { name: 'Undo' }).click();
  await expect(activity.locator('.log-entry')).toHaveCount(1);
  await expect(first.getByText('Reread for Yellow')).toBeVisible();
  await first.getByRole('button', { name: 'No Response' }).click();
  await expect(activity.locator('.log-entry').first()).toContainText('NR');
  await expect(activity.locator('.log-entry')).toHaveCount(2);

  await page.evaluate(() => {
    document.body.dataset.printCalls = '0';
    window.print = () => { document.body.dataset.printCalls = String(Number(document.body.dataset.printCalls) + 1); };
  });
  await practice.getByRole('button', { name: 'Print quiz', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-print-calls', '1');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.app-toolbar')).toBeHidden();
  await expect(first.locator('.print-slash')).toBeHidden();
  await expect(first.locator('.attempt-history')).toBeHidden();
  await expect(first.locator('.record-controls')).toBeHidden();
  if (testInfo.project.name === 'desktop') expect((await page.pdf({ path: testInfo.outputPath('clean-quiz.pdf') })).byteLength).toBeGreaterThan(1000);
  await page.emulateMedia({ media: 'screen' });
  await practice.getByRole('button', { name: 'Review print' }).click();
  await practice.getByRole('button', { name: 'Print review' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-print-calls', '2');
  await page.emulateMedia({ media: 'print' });
  await expect(first.locator('.print-slash')).toBeVisible();
  await expect(first.locator('.attempt-history')).toBeVisible();
  await expect(first.locator('.record-controls')).toBeHidden();
  if (testInfo.project.name === 'desktop') expect((await page.pdf({ path: testInfo.outputPath('review-quiz.pdf') })).byteLength).toBeGreaterThan(1000);
  await page.emulateMedia({ media: 'screen' });

  const [recorded] = await sessions(page);
  expect(recorded.attempts).toEqual([
    expect.objectContaining({ result: 'incorrect', type: 'original', team: 'red', quizzerId: 'R1', interruption: expect.objectContaining({ wordIndex: 1 }) }),
    expect.objectContaining({ result: 'nr', type: 'reread', team: 'yellow', quizzerId: undefined }),
  ]);
  await page.reload();
  await expect(practice.locator('.log-entry')).toHaveCount(2);
  expect(await sessions(page)).toEqual([recorded]);
  await practice.getByRole('button', { name: /Library/ }).click();
  await expect(page.getByRole('heading', { name: 'Recent practice' })).toBeVisible();
  await page.reload();
  practice = await openPublished(page);
  await expect(practice.locator('.log-entry')).toHaveCount(2);
  expect(await sessions(page)).toEqual([recorded]);

  page.once('dialog', dialog => dialog.accept());
  await practice.getByRole('button', { name: 'Reset Practice' }).click();
  await expect(practice.getByText('No attempts')).toBeVisible();
  const all = await sessions(page);
  expect(all).toHaveLength(2);
  expect(all.find(item => item.id === recorded.id)).toEqual(recorded);
  expect(all.find(item => item.id !== recorded.id)?.attempts).toEqual([]);
  await practice.getByRole('button', { name: /Library/ }).click();
  practice = await openPublished(page);
  await expect(practice.getByText('No attempts')).toBeVisible();
});

test('keeps missing saved question slots and reports unavailable Scripture', async ({ page }) => {
  const fixture = structuredClone(saveFixture);
  const quiz = fixture.customQuizzes[0];
  quiz.questionIds.splice(1, 0, 'missing-practice-question');
  fixture.userQuestions[1].references = [{ book: 'Psalms', chapter: 3, startVerse: 999 }, { book: 'Unknown', chapter: 1, startVerse: 1 }];
  fixture.userQuestions[0].references = [];
  await page.getByRole('button', { name: 'Quizzes' }).click();
  await expect(page.locator('.collection-card')).toHaveCount(2);
  await page.evaluate(async data => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('bqquiz-local', 3);
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(Object.keys(data), 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
        for (const [name, rows] of Object.entries(data)) for (const record of rows) tx.objectStore(name).add(record);
      });
    } finally { db.close(); }
  }, fixture);
  await page.reload();
  await page.getByRole('button', { name: /Saved shell fixture \(original\)/ }).click();
  const practice = page.getByRole('region', { name: 'Practice quiz' });
  const questions = practice.locator('.practice-question');
  await expect(questions).toHaveCount(3);
  await expect(questions.nth(0).locator('.practice-question-text')).toHaveText('Synthetic question 2', { useInnerText: true });
  await expect(questions.nth(1)).toContainText('Question unavailable. missing-practice-question');
  await expect(questions.nth(2).locator('.question-number')).toHaveText('03');
  await expect(questions.nth(2)).toContainText('No structured Scripture reference.');
  await practice.getByRole('button', { name: 'Psalms 3:999' }).click();
  const drawer = practice.getByRole('complementary', { name: 'Scripture reference' });
  await expect(drawer).toContainText('Verified verse text is unavailable locally.');
  await drawer.getByRole('button', { name: 'Close Scripture reference' }).click();
  await practice.getByRole('button', { name: 'Unknown 1:1' }).click();
  await expect(drawer).toContainText('This Scripture reference is invalid.');
});
