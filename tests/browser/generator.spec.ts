import { expect, test } from '@playwright/test';
import type { GeneratedQuiz } from '../../src/features/quizzes/types';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bq-search-walkthrough-v1', 'dismissed'));
  await page.goto('./');
  await page.getByRole('button', { name: 'Quizzes', exact: true }).click();
});

test('lays out the Generator and exposes the primary action in every viewport', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'desktop') await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Generate Quiz', exact: true }).click();
  const generator = page.getByRole('region', { name: 'Generate quiz' });
  await expect(generator.getByText('891 eligible questions')).toBeVisible();
  await expect(generator.getByText('9 excluded: no structured Scripture reference.')).toBeVisible();
  await expect(generator.getByText('questions · 350 possible points')).toBeVisible();
  await expect(generator.locator('.availability-row').first()).toHaveCSS('display', 'grid');
  const setup = await generator.locator('.generator-setup').boundingBox();
  const filters = await generator.locator('.generator-filters').boundingBox();
  expect(setup).toBeTruthy();
  expect(filters).toBeTruthy();
  if (page.viewportSize()!.width > 900) {
    expect(filters!.x).toBeGreaterThanOrEqual(setup!.x + setup!.width);
    expect(filters!.y).toBe(setup!.y);
  } else {
    expect(filters!.x).toBe(setup!.x);
    expect(filters!.y).toBeGreaterThanOrEqual(setup!.y + setup!.height);
  }
  await page.screenshot({ path: testInfo.outputPath('generator.png'), animations: 'disabled' });
  await generator.getByText('Question types', { exact: true }).click();
  await expect(generator.getByLabel('Search question types')).toBeVisible();
  const geometry = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('.quiz-generator .generator-field :is(input, select)')).filter(element => element.getClientRects().length > 0);
    const bounds = inputs.map(element => element.getBoundingClientRect());
    const overlaps = bounds.some((a, index) => bounds.slice(index + 1).some(b => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top));
    return { overlaps, controlsInBounds: bounds.every(r => r.left >= 0 && r.right <= innerWidth && r.width > 0), pageWidth: document.documentElement.scrollWidth, viewport: innerWidth };
  });
  expect(geometry).toEqual({ overlaps: false, controlsInBounds: true, pageWidth: geometry.viewport, viewport: geometry.viewport });
  const generate = generator.locator('.generator-button');
  await generate.scrollIntoViewIfNeeded();
  expect(await generate.evaluate(button => {
    const rect = button.getBoundingClientRect();
    const toolbar = document.querySelector('.app-toolbar')!.getBoundingClientRect();
    return rect.top >= toolbar.bottom && button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
  })).toBe(true);
});

test('restores quiz navigation, verse range, and ordered preview through reload and history', async ({ page }) => {
  await page.getByRole('button', { name: 'Generate Quiz', exact: true }).click();
  const generator = page.getByRole('region', { name: 'Generate quiz' });
  const start = generator.getByLabel('Start Verse', { exact: true });
  const end = generator.getByLabel('End Verse', { exact: true });
  await start.fill('3:2');
  await end.fill('Psa. 3.1');
  await expect(generator.getByText('End Verse must be at or after Start Verse.')).toBeVisible();
  await generator.getByRole('combobox', { name: 'Browse start verse' }).selectOption({ label: '#1 · Psalms 3:1' });
  await expect(generator.getByText('1 study verse selected')).toBeVisible();
  await generator.getByRole('combobox', { name: 'Browse end verse' }).selectOption({ label: '#429 · Psalms 103:22' });
  await expect(start).toHaveValue('#1 · Psalms 3:1');
  await expect(end).toHaveValue('#429 · Psalms 103:22');
  await start.fill('3.2');
  await start.press('Enter');
  await expect(generator.getByText('428 study verses selected')).toBeVisible();
  await expect(start).toHaveValue('#2 · Psalms 3:2');
  await generator.getByLabel('Title').fill('History quiz');
  await generator.locator('.generator-button').click();
  const questions = generator.locator('.generator-selection li');
  await expect(questions).toHaveCount(20);
  const orderedPreview = await questions.allTextContents();

  await page.reload();
  await expect(start).toHaveValue('#2 · Psalms 3:2');
  await expect(end).toHaveValue('#429 · Psalms 103:22');
  await expect(generator.getByLabel('Title')).toHaveValue('History quiz');
  await expect(questions).toHaveText(orderedPreview.map(question => question.replace(/\s+/g, ' ').trim()));

  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Collections', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('textbox', { name: 'Search Scripture' })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Collections', exact: true })).toBeVisible();
  await page.goForward();
  await expect(start).toHaveValue('#2 · Psalms 3:2');
  await expect(questions).toHaveCount(20);
  await generator.getByRole('button', { name: 'Save generated quiz' }).click();
  await page.getByRole('button', { name: /History quiz/ }).click();
  const practice = page.getByRole('region', { name: 'Practice quiz' });
  await expect(practice).toBeVisible();
  await page.reload();
  await expect(practice).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('button', { name: /History quiz/ })).toBeVisible();
  await page.goForward();
  await expect(practice).toBeVisible();
});

test('filters exact types, restores a preset, and plays the generated quiz in stored order', async ({ page }) => {
  await page.getByRole('button', { name: 'Generate Quiz', exact: true }).click();
  const generator = page.getByRole('region', { name: 'Generate quiz' });
  const eligible = generator.locator('.generator-availability > strong');
  await expect(eligible).toHaveText('891 eligible questions');
  const restrict = generator.getByLabel('Restrict to selected study range');
  await restrict.uncheck();
  await expect(eligible).toHaveText('900 eligible questions');
  await generator.getByText('Question types', { exact: true }).click();
  const types = generator.getByRole('group', { name: 'Question types' });
  await expect(types.getByRole('checkbox')).toHaveCount(14);
  await types.getByRole('button', { name: 'Clear all' }).click();
  await expect(eligible).toHaveText('0 eligible questions');
  await generator.getByLabel('Search question types').fill('quotation');
  await expect(types.getByRole('checkbox')).toHaveCount(3);
  await types.getByRole('checkbox', { name: 'Quotation', exact: true }).check();
  await expect(eligible).toHaveText('113 eligible questions');
  const publishers = generator.getByRole('group', { name: 'Publishers' });
  await publishers.getByRole('button', { name: 'Clear all' }).click();
  await publishers.getByRole('checkbox', { name: 'BQ Powers' }).check();
  await expect(eligible).toHaveText('56 eligible questions');
  const collections = generator.getByRole('group', { name: 'Collections' });
  await collections.getByRole('button', { name: 'Clear all' }).click();
  await collections.getByRole('checkbox', { name: /Lift Up/ }).check();
  await expect(eligible).toHaveText('0 eligible questions');
  await generator.locator('.generator-button').click();
  await expect(generator.getByRole('status')).toContainText('Only 0 eligible 10-point questions');
  await publishers.getByRole('button', { name: 'Select all' }).click();
  await collections.getByRole('button', { name: 'Select all' }).click();
  await types.getByRole('button', { name: 'Select all' }).click();

  await restrict.check();
  await generator.getByLabel('Start Verse', { exact: true }).fill('Psalm 3:1');
  await generator.getByLabel('End Verse', { exact: true }).fill('Psalms 3:2');
  page.once('dialog', dialog => dialog.accept('Opening Psalms'));
  await generator.getByRole('button', { name: 'Save preset' }).click();
  await expect(generator.getByRole('status')).toContainText('Coverage preset saved');
  await generator.getByLabel('End Verse', { exact: true }).fill('Psalms 3:3');
  await generator.getByLabel('Coverage preset').selectOption({ label: 'Opening Psalms' });
  await expect(generator.getByLabel('End Verse', { exact: true })).toHaveValue(/Psalms 3:2$/);

  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('bqquiz-local', 3);
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('coveragePresets', 'readwrite');
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error);
        transaction.objectStore('coveragePresets').add({
          id: 'standalone-coverage-fixture', name: 'Standalone V5 range', updatedAt: '2026-01-02T03:04:05.000Z',
          range: { start: { book: 'Psalm', chapter: 3, startVerse: 1 }, end: { book: 'Psalms', chapter: 3, startVerse: 2 } },
        });
      });
    } finally { db.close(); }
  });

  await page.getByRole('button', { name: 'Question Bank', exact: true }).click();
  const payload = {
    schemaVersion: 1,
    collections: [{ id: 'generator-fixture', name: 'Generator fixture', publisher: 'Synthetic generator' }],
    questions: [10, 20].map((pointValue, index) => ({
      id: `generated-source-${pointValue}`, collectionId: 'generator-fixture', pointValue, classification: 'Two Part',
      rawQuestion: `Synthetic ${pointValue}-point question`, rawAnswer: `Synthetic answer ${pointValue}`,
      references: [{ book: 'Psalms', chapter: 3, startVerse: index + 1 }],
    })),
  };
  await page.locator('.question-bank-v5 input[type=file]').setInputFiles({
    name: 'generator-fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(payload)),
  });
  await page.getByRole('button', { name: 'Commit import' }).click();
  await expect(page.getByText(/Imported 2 user questions/)).toBeVisible();
  await page.getByRole('button', { name: 'Generate Quiz', exact: true }).click();
  await generator.getByLabel('Coverage preset').selectOption({ label: 'Standalone V5 range' });
  await expect(generator.getByLabel('End Verse', { exact: true })).toHaveValue(/Psalms 3:2$/);
  await generator.getByLabel('Title').fill('Generated workflow fixture');
  await collections.getByRole('button', { name: 'Clear all' }).click();
  await collections.getByRole('checkbox', { name: /Synthetic generator · Generator fixture/ }).check();
  await expect(eligible).toHaveText('2 eligible questions');
  await generator.getByLabel('Default distribution').uncheck();
  await generator.getByLabel('10-point questions').fill('1');
  await generator.getByLabel('20-point questions').fill('1');
  await generator.getByLabel('30-point questions').fill('0');
  await generator.getByRole('radio', { name: 'Fully random' }).check();
  await generator.locator('.generator-button').click();
  const preview = generator.getByRole('region', { name: 'Preview' });
  await expect(preview.locator('[data-question-id]')).toHaveCount(2);
  expect(await preview.locator('[data-question-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-question-id'))))
    .toEqual(['generated-source-10', 'generated-source-20']);
  await generator.getByRole('radio', { name: 'Balanced across chapters' }).check();
  await expect(preview).toHaveCount(0);
  await generator.getByRole('radio', { name: 'Fully random' }).check();
  await preview.getByRole('button', { name: 'Regenerate' }).click();
  await preview.getByRole('button', { name: 'Save generated quiz' }).click();
  const saved = page.getByRole('region', { name: 'Saved quizzes' });
  await expect(saved).toBeFocused();
  const savedQuiz = await page.evaluate(async (): Promise<GeneratedQuiz> => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('bqquiz-local', 3);
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const read = db.transaction('customQuizzes').objectStore('customQuizzes').getAll();
        read.onsuccess = () => resolve(read.result.find(item => item.title === 'Generated workflow fixture'));
        read.onerror = () => reject(read.error);
      });
    } finally { db.close(); }
  });
  expect(savedQuiz.questionIds).toEqual(['generated-source-10', 'generated-source-20']);
  expect(savedQuiz.filters).toMatchObject({ strategy: 'random', collectionIds: ['generator-fixture'], pointCounts: { 10: 1, 20: 1, 30: 0 } });
  await saved.getByRole('button', { name: /Generated workflow fixture/ }).click();
  const practice = page.getByRole('region', { name: 'Practice quiz' });
  await expect(practice.locator('.practice-question-text')).toHaveText(['Synthetic 10-point question', 'Synthetic 20-point question']);
  await expect(practice.locator('.answer-line p')).toHaveText(['Synthetic answer 10', 'Synthetic answer 20']);
  await expect(practice.getByRole('button', { name: 'Psalms 3:2' })).toBeVisible();
  await expect(practice.getByRole('group', { name: 'Red team' }).first().getByRole('button', { name: 'R1' })).toBeVisible();
});
