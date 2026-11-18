import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { getInstalledCatalog, listCatalogs, saveCatalog } from './storage';
import type { QuizCatalog } from '../types';

const catalog = (id: string, installedAt: string): QuizCatalog => ({ schemaVersion: 2, sourceSet: { id, title: id, edition: 'test', status: 'verified' }, collections: [], quizzes: [], questions: [], catalogId: id, catalogVersion: 'test-2', installedAt });

describe('isolated published catalog storage', () => {
  beforeEach(async () => { await new Promise<void>((resolve, reject) => { const request = indexedDB.deleteDatabase('bqsearch-quizzes'); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); }); });
  it('stores catalogs separately and selects the newest installed catalog', async () => {
    await saveCatalog(catalog('old', '2027-01-01T00:00:00.000Z')); await saveCatalog(catalog('new', '2027-02-01T00:00:00.000Z'));
    expect((await listCatalogs()).map(item => item.catalogId).sort()).toEqual(['new', 'old']);
    expect((await getInstalledCatalog())?.catalogId).toBe('new');
  });
});
