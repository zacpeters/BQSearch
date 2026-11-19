import type { QuizPracticeSession, UserCollection, UserQuestion } from '../types';
import { makeSession, type PracticeSession } from '../practice/practice';

const DB_NAME = 'bqquiz-local'; const DB_VERSION = 3;
function openDb(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const request = indexedDB.open(DB_NAME, DB_VERSION); request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains('sessions')) { const store = db.createObjectStore('sessions', { keyPath: 'id' }); store.createIndex('by-quiz', 'quizId'); } if (!db.objectStoreNames.contains('customQuizzes')) { const store = db.createObjectStore('customQuizzes', { keyPath: 'id' }); store.createIndex('by-updated', 'updatedAt'); } if (!db.objectStoreNames.contains('coveragePresets')) { const store = db.createObjectStore('coveragePresets', { keyPath: 'id' }); store.createIndex('by-updated', 'updatedAt'); } if (!db.objectStoreNames.contains('userCollections')) { const store = db.createObjectStore('userCollections', { keyPath: 'id' }); store.createIndex('by-updated', 'updatedAt'); } if (!db.objectStoreNames.contains('userQuestions')) { const store = db.createObjectStore('userQuestions', { keyPath: 'id' }); store.createIndex('by-collection', 'collectionId'); } }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
function all<T>(store: string): Promise<T[]> { return openDb().then(db => new Promise((resolve, reject) => { const request = db.transaction(store).objectStore(store).getAll(); request.onsuccess = () => { db.close(); resolve(request.result as T[]); }; request.onerror = () => { db.close(); reject(request.error); }; })); }
export const listUserCollections = () => all<UserCollection>('userCollections');
export const listUserQuestions = () => all<UserQuestion>('userQuestions');
export const listQuizSessions = () => all<QuizPracticeSession>('sessions');
export async function saveUserCollection(collection: UserCollection) { const db = await openDb(); return new Promise<void>((resolve, reject) => { const request = db.transaction('userCollections', 'readwrite').objectStore('userCollections').put(collection); request.onsuccess = () => { db.close(); resolve(); }; request.onerror = () => { db.close(); reject(request.error); }; }); }
export async function deleteUserCollection(id: string) { const db = await openDb(); return new Promise<void>((resolve, reject) => { const transaction = db.transaction(['userCollections', 'userQuestions'], 'readwrite'); transaction.objectStore('userCollections').delete(id); const questions = transaction.objectStore('userQuestions').index('by-collection').getAllKeys(id); questions.onsuccess = () => questions.result.forEach(key => transaction.objectStore('userQuestions').delete(key)); transaction.oncomplete = () => { db.close(); resolve(); }; transaction.onerror = () => { db.close(); reject(transaction.error); }; }); }
export async function saveUserQuestion(question: UserQuestion) { const db = await openDb(); return new Promise<void>((resolve, reject) => { const request = db.transaction('userQuestions', 'readwrite').objectStore('userQuestions').put(question); request.onsuccess = () => { db.close(); resolve(); }; request.onerror = () => { db.close(); reject(request.error); }; }); }
export async function deleteUserQuestion(id: string) { const db = await openDb(); return new Promise<void>((resolve, reject) => { const request = db.transaction('userQuestions', 'readwrite').objectStore('userQuestions').delete(id); request.onsuccess = () => { db.close(); resolve(); }; request.onerror = () => { db.close(); reject(request.error); }; }); }
export async function commitUserContent(collections: UserCollection[], questions: UserQuestion[]) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['userCollections', 'userQuestions'], 'readwrite');
    const userCollections = transaction.objectStore('userCollections');
    const userQuestions = transaction.objectStore('userQuestions');
    let invalidDestination: string | undefined;
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onabort = () => {
      db.close();
      reject(invalidDestination ? new Error(`User collection ${invalidDestination} is no longer available. Reopen Quizzes before retrying.`)
        : transaction.error ?? new Error('Import transaction aborted.'));
    };
    for (const collection of collections) userCollections.add(collection);
    for (const question of questions) {
      const destination = userCollections.getKey(question.collectionId);
      destination.onsuccess = () => {
        if (destination.result === undefined) {
          invalidDestination = question.collectionId;
          transaction.abort();
        } else {
          userQuestions.add(question);
        }
      };
    }
  });
}

export async function openPracticeSession(quizId: string): Promise<PracticeSession> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sessions', 'readwrite');
    const store = tx.objectStore('sessions');
    const request = store.index('by-quiz').getAll(quizId);
    let session: PracticeSession;
    let validationError: Error | undefined;
    request.onsuccess = () => {
      const latest = (request.result as PracticeSession[]).sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))[0];
      if (latest) {
        if (!Array.isArray(latest.attempts) || !latest.attempts.every(attempt => attempt && typeof attempt.id === 'string' && typeof attempt.createdAt === 'string') || !latest.states || typeof latest.states !== 'object' || Array.isArray(latest.states)) {
          validationError = new Error('The saved practice session cannot be read. Its records have been kept.');
          tx.abort();
          return;
        }
        session = latest;
      } else {
        session = makeSession(quizId);
        store.add(session);
      }
    };
    tx.oncomplete = () => { db.close(); resolve(session); };
    tx.onabort = () => { db.close(); reject(validationError ?? tx.error ?? new Error('Unable to open the practice session.')); };
  });
}

export async function savePracticeSession(next: PracticeSession, previous?: PracticeSession) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('sessions', 'readwrite');
    const store = tx.objectStore('sessions');
    let conflict = false;
    if (previous) {
      const request = store.get(next.id);
      request.onsuccess = () => {
        if (next.id !== previous.id || JSON.stringify(request.result) !== JSON.stringify(previous)) {
          conflict = true;
          tx.abort();
        } else {
          store.put(next);
        }
      };
    } else {
      store.add(next);
    }
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => {
      db.close();
      reject(conflict ? new Error('This practice session changed in another tab. Return to the Library and reopen the quiz.') : tx.error ?? new Error('Unable to save the practice session.'));
    };
  });
}
