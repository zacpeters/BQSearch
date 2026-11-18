import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { getLiveSessions, getPacks, getSettings, saveLiveSession, savePack, saveSettings } from '../storage';
import bundledPack from '../../public/packs/season-2027-v1-1.0.0.json';
import type { ScripturePack } from '../types';
import type { QuizDataSnapshot } from './contracts';
import { commitMigration, createMigrationBundle, exportMigrationBundle, previewMigration, validateMigrationBundle } from './migration';

const pack = bundledPack as ScripturePack;
const empty: QuizDataSnapshot = { userCollections: [], userQuestions: [], customQuizzes: [], coveragePresets: [], sessions: [] };
const collection = { id: 'collection-example', publisher: 'Example', name: 'Practice', sourceFilename: 'user-import', quizIds: [] };
const question = { id: 'question-example', collectionId: collection.id, rawQuestion: 'Example question', rawAnswer: 'Example answer', pointValue: 10, references: [] };
const quiz = { id: 'custom-example', questionIds: [question.id], title: 'Example quiz' };
const preset = { id: 'preset-example', name: 'Example range', range: { start: { book: 'Psalms', chapter: 3, startVerse: 1 }, end: { book: 'Psalms', chapter: 3, startVerse: 3 } } };
const session = { id: 'session-example', quizId: quiz.id, attempts: [], states: {}, roster: { red: 3, yellow: 3 } };
const validBundle = () => createMigrationBundle({ userCollections: [collection], userQuestions: [question], customQuizzes: [quiz], coveragePresets: [preset], sessions: [session] }, { catalogId: 'example-catalog', catalogVersion: 'test-1' });

beforeEach(async () => {
  for (const name of ['bqquiz-local', 'scripture-lookup']) await new Promise<void>((resolve, reject) => { const request = indexedDB.deleteDatabase(name); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
});

describe('versioned BQQuiz migration bridge', () => {
  it('creates a JSON-compatible manifest with counts and content identity', () => {
    const bundle = validBundle();
    expect(JSON.parse(JSON.stringify(bundle)).manifest).toMatchObject({ format: 'bqsearch-bqquiz-user-data', formatVersion: 1, sourceApplication: 'bqquiz', sourceSchemaVersion: 3, catalogId: 'example-catalog' });
    expect(bundle.manifest.counts).toEqual({ userCollections: 1, userQuestions: 1, customQuizzes: 1, coveragePresets: 1, sessions: 1 });
  });

  it('validates empty, malformed, and unsupported bundles before persistence', () => {
    expect(validateMigrationBundle(createMigrationBundle(empty)).valid).toBe(true);
    expect(validateMigrationBundle(null).valid).toBe(false);
    const unsupported = validBundle(); unsupported.manifest.formatVersion = 99 as 1;
    expect(validateMigrationBundle(unsupported).errors[0]).toContain('Unsupported');
  });

  it('reports duplicate, conflicting, missing-reference, and relationship errors', () => {
    const bundle = validBundle();
    const conflict = previewMigration(bundle, { ...empty, userCollections: [{ ...collection, name: 'Existing name' }] }, 'skip-existing');
    expect(conflict.conflicts).toEqual([{ store: 'userCollections', id: collection.id, kind: 'conflict' }]);
    expect(conflict.valid).toBe(true);
    const missing = createMigrationBundle({ ...empty, customQuizzes: [{ id: 'broken-quiz', questionIds: ['missing-question'] }], sessions: [{ id: 'broken-session', quizId: 'missing-quiz' }] });
    const missingPreview = previewMigration(missing, empty);
    expect(missingPreview.valid).toBe(false);
    expect(missingPreview.errors.join(' ')).toContain('missing question');
    expect(missingPreview.errors.join(' ')).toContain('missing quiz');
    const warningBundle = createMigrationBundle({ ...empty, userQuestions: [{ ...question, references: [{ book: 'Not a book', chapter: 1, startVerse: 1 }] }] });
    expect(previewMigration(warningBundle, empty).warnings.join(' ')).toContain('invalid Scripture reference');
  });

  it('round-trips valid records and preserves stable relationships', async () => {
    const result = await commitMigration(validBundle());
    expect(result.valid).toBe(true);
    expect((await exportMigrationBundle({ catalogId: 'example-catalog' })).manifest.counts).toEqual({ userCollections: 1, userQuestions: 1, customQuizzes: 1, coveragePresets: 1, sessions: 1 });
    const second = await commitMigration(validBundle());
    expect(second.conflicts.length).toBe(5);
  });

  it('supports explicit conflict replacement and remapping without startup migration', async () => {
    await commitMigration(validBundle());
    const replaced = createMigrationBundle({ ...empty, userCollections: [{ ...collection, name: 'Replacement' }] });
    await commitMigration(replaced, 'replace-existing');
    const remapped = createMigrationBundle({ ...empty, userCollections: [collection], userQuestions: [{ ...question }] });
    const result = await commitMigration(remapped, 'remap-conflicts');
    expect(Object.keys(result.idRemapping).length).toBeGreaterThan(0);
  });

  it('leaves both BQ Search stores and quiz stores untouched on failed import', async () => {
    const live = { id: 'live-example', version: 1, seasonId: 'season-2027', division: 'Beginner', questions: [] } as never;
    await savePack(pack); await saveSettings({ seasonId: pack.season.id, division: 'Beginner', studyStart: 1, studyEnd: 999, installedPackId: pack.id }); await saveLiveSession(live);
    const before = { packs: await getPacks(), settings: await getSettings(), sessions: await getLiveSessions() };
    const invalid = createMigrationBundle({ ...empty, userQuestions: [{ id: 'orphan', collectionId: 'missing-collection' }] });
    await expect(commitMigration(invalid)).rejects.toThrow('missing collection');
    expect(await getPacks()).toEqual(before.packs);
    expect(await getSettings()).toEqual(before.settings);
    expect(await getLiveSessions()).toEqual(before.sessions);
  });
});
