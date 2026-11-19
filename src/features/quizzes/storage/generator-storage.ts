import type { CoveragePreset, GeneratedQuiz } from '../types';

const DB_NAME = 'bqquiz-local'; const DB_VERSION = 3;
function openDb(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const request = indexedDB.open(DB_NAME, DB_VERSION); request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains('sessions')) { const store = db.createObjectStore('sessions', { keyPath: 'id' }); store.createIndex('by-quiz', 'quizId'); } if (!db.objectStoreNames.contains('customQuizzes')) { const store = db.createObjectStore('customQuizzes', { keyPath: 'id' }); store.createIndex('by-updated', 'updatedAt'); } if (!db.objectStoreNames.contains('coveragePresets')) { const store = db.createObjectStore('coveragePresets', { keyPath: 'id' }); store.createIndex('by-updated', 'updatedAt'); } if (!db.objectStoreNames.contains('userCollections')) { const store = db.createObjectStore('userCollections', { keyPath: 'id' }); store.createIndex('by-updated', 'updatedAt'); } if (!db.objectStoreNames.contains('userQuestions')) { const store = db.createObjectStore('userQuestions', { keyPath: 'id' }); store.createIndex('by-collection', 'collectionId'); } }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
function read<T>(store: string): Promise<T[]> { return openDb().then(db => new Promise((resolve, reject) => { const request = db.transaction(store).objectStore(store).getAll(); request.onsuccess = () => { db.close(); resolve(request.result as T[]); }; request.onerror = () => { db.close(); reject(request.error); }; })); }
export const listGeneratedQuizzes = () => read<GeneratedQuiz>('customQuizzes');
export const listCoveragePresets = () => read<CoveragePreset>('coveragePresets');
function write(store: string, value: unknown) {
  return openDb().then(db => new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(store, 'readwrite');
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error('Unable to save quiz data.')); };
    transaction.objectStore(store).put(value);
  }));
}
export const saveGeneratedQuiz = (quiz: GeneratedQuiz) => write('customQuizzes', quiz);
export const saveCoveragePreset = (preset: CoveragePreset) => write('coveragePresets', preset);
export async function deleteGeneratedQuiz(id: string) { const db = await openDb(); return new Promise<void>((resolve, reject) => { const request = db.transaction('customQuizzes', 'readwrite').objectStore('customQuizzes').delete(id); request.onsuccess = () => { db.close(); resolve(); }; request.onerror = () => { db.close(); reject(request.error); }; }); }
export async function deleteCoveragePreset(id: string) { const db = await openDb(); return new Promise<void>((resolve, reject) => { const request = db.transaction('coveragePresets', 'readwrite').objectStore('coveragePresets').delete(id); request.onsuccess = () => { db.close(); resolve(); }; request.onerror = () => { db.close(); reject(request.error); }; }); }
