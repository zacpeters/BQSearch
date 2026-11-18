import type { CustomQuizRecord, CoveragePresetRecord, MigrationManifest, PracticeSessionRecord, QuizCollectionRecord, QuizDataSnapshot, QuizMigrationBundle, QuizQuestionRecord } from './contracts';
import { normalizeScriptureReference } from './scripture-provider';

export const MIGRATION_FORMAT = 'bqsearch-bqquiz-user-data' as const;
export const MIGRATION_VERSION = 1 as const;
export const QUIZ_DB_NAME = 'bqquiz-local';
const STORES = ['sessions', 'customQuizzes', 'coveragePresets', 'userCollections', 'userQuestions'] as const;
type StoreName = typeof STORES[number];
type RecordMap = Record<string, Record<string, unknown>>;

export interface MigrationValidation { valid: boolean; errors: string[]; warnings: string[]; }
export type ConflictPolicy = 'skip-existing' | 'replace-existing' | 'remap-conflicts';
export interface MigrationConflict { store: StoreName; id: string; kind: 'duplicate' | 'conflict'; }
export interface MigrationPreview { valid: boolean; errors: string[]; warnings: string[]; conflicts: MigrationConflict[]; counts: Record<keyof QuizDataSnapshot, number>; idRemapping: Record<string, string>; }

const keys = ['userCollections', 'userQuestions', 'customQuizzes', 'coveragePresets', 'sessions'] as const;
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function records(value: unknown): value is Record<string, unknown>[] { return Array.isArray(value) && value.every(isRecord); }
function required(record: Record<string, unknown>, fields: string[]) { return fields.every(field => typeof record[field] === 'string' && String(record[field]).length > 0); }
function counts(data: QuizDataSnapshot) { return Object.fromEntries(keys.map(key => [key, data[key].length])) as Record<keyof QuizDataSnapshot, number>; }

export function validateMigrationBundle(value: unknown): MigrationValidation {
  const errors: string[] = []; const warnings: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ['Bundle must be a JSON object.'], warnings };
  const manifest = value.manifest;
  if (!isRecord(manifest) || manifest.format !== MIGRATION_FORMAT || manifest.formatVersion !== MIGRATION_VERSION || manifest.sourceApplication !== 'bqquiz' || !Number.isInteger(manifest.sourceSchemaVersion)) errors.push('Unsupported or malformed migration manifest.');
  if (!isRecord(value.data)) errors.push('Bundle data is missing.');
  if (!isRecord(value.data)) return { valid: false, errors, warnings };
  for (const key of keys) {
    if (!records(value.data[key])) { errors.push(`data.${key} must be an array of records.`); continue; }
    for (const [index, record] of value.data[key].entries()) {
      if (!required(record, ['id'])) errors.push(`data.${key}[${index}] is missing id.`);
    }
  }
  for (const [index, record] of (records(value.data.userQuestions) ? value.data.userQuestions : []).entries()) {
    if (record.collectionId !== undefined && typeof record.collectionId !== 'string') errors.push(`data.userQuestions[${index}].collectionId must be a string.`);
    if (record.references !== undefined && !Array.isArray(record.references)) warnings.push(`data.userQuestions[${index}].references is not an array.`);
  }
  for (const [index, record] of (records(value.data.customQuizzes) ? value.data.customQuizzes : []).entries()) if (!Array.isArray(record.questionIds) || record.questionIds.some(id => typeof id !== 'string')) errors.push(`data.customQuizzes[${index}].questionIds must be string IDs.`);
  for (const [index, record] of (records(value.data.sessions) ? value.data.sessions : []).entries()) if (typeof record.quizId !== 'string' || !record.quizId) errors.push(`data.sessions[${index}].quizId is required.`);
  return { valid: errors.length === 0, errors, warnings };
}

export function createMigrationBundle(data: QuizDataSnapshot, metadata: { sourceSchemaVersion?: number; catalogId?: string; catalogVersion?: string; exportedAt?: string } = {}): QuizMigrationBundle {
  const manifest: MigrationManifest = { format: MIGRATION_FORMAT, formatVersion: MIGRATION_VERSION, sourceApplication: 'bqquiz', sourceSchemaVersion: metadata.sourceSchemaVersion ?? 3, exportedAt: metadata.exportedAt ?? new Date().toISOString(), counts: counts(data), ...(metadata.catalogId ? { catalogId: metadata.catalogId } : {}), ...(metadata.catalogVersion ? { catalogVersion: metadata.catalogVersion } : {}) };
  return { manifest, data: structuredClone(data) };
}

function storeData(data: QuizDataSnapshot): Record<StoreName, Record<string, unknown>[]> {
  return { userCollections: data.userCollections, userQuestions: data.userQuestions, customQuizzes: data.customQuizzes, coveragePresets: data.coveragePresets, sessions: data.sessions };
}

function remapRecord(record: Record<string, unknown>, store: StoreName, mapping: Record<string, string>) {
  const copy = structuredClone(record);
  if (store === 'userQuestions' && typeof copy.collectionId === 'string') copy.collectionId = mapping[copy.collectionId] ?? copy.collectionId;
  if (store === 'customQuizzes' && Array.isArray(copy.questionIds)) copy.questionIds = copy.questionIds.map(id => typeof id === 'string' ? mapping[id] ?? id : id);
  if (store === 'sessions' && typeof copy.quizId === 'string') copy.quizId = mapping[copy.quizId] ?? copy.quizId;
  copy.id = mapping[String(copy.id)] ?? copy.id;
  return copy;
}

export function previewMigration(bundle: unknown, existing: QuizDataSnapshot, policy: ConflictPolicy = 'skip-existing'): MigrationPreview {
  const validation = validateMigrationBundle(bundle);
  const empty = { valid: false, errors: validation.errors, warnings: validation.warnings, conflicts: [], counts: { userCollections: 0, userQuestions: 0, customQuizzes: 0, coveragePresets: 0, sessions: 0 }, idRemapping: {} } satisfies MigrationPreview;
  if (!validation.valid) return empty;
  const typed = bundle as QuizMigrationBundle; const conflicts: MigrationConflict[] = []; const idRemapping: Record<string, string> = {};
  const existingByStore = storeData(existing);
  const seen = new Set<string>();
  for (const store of STORES) for (const record of typed.data[store]) {
    const id = String(record.id); const key = `${store}:${id}`;
    if (seen.has(key)) conflicts.push({ store, id, kind: 'duplicate' });
    seen.add(key);
    const current = existingByStore[store].find(item => item.id === id);
    if (current) {
      const kind = JSON.stringify(current) === JSON.stringify(record) ? 'duplicate' : 'conflict';
      conflicts.push({ store, id, kind });
      if (policy === 'remap-conflicts') idRemapping[id] = `${id}-import-${existingByStore[store].length + 1}`;
    }
  }
  const importedQuestions = new Set(typed.data.userQuestions.map(record => record.id));
  const existingQuestions = new Set(existing.userQuestions.map(record => record.id));
  const importedCollections = new Set(typed.data.userCollections.map(record => record.id));
  const existingCollections = new Set(existing.userCollections.map(record => record.id));
  const questionIds = (id: string) => importedQuestions.has(id) || existingQuestions.has(id);
  const collectionIds = (id: string) => importedCollections.has(id) || existingCollections.has(id);
  const errors = [...validation.errors]; const warnings = [...validation.warnings];
  for (const question of typed.data.userQuestions) if (typeof question.collectionId === 'string' && !collectionIds(question.collectionId)) errors.push(`Question ${question.id} references missing collection ${question.collectionId}.`);
  for (const question of typed.data.userQuestions) if (Array.isArray(question.references)) for (const reference of question.references) {
    if (!isRecord(reference)) { warnings.push(`Question ${question.id} contains a non-object Scripture reference.`); continue; }
    try { normalizeScriptureReference(reference as { book: string; chapter: number; startVerse: number; endVerse?: number }); } catch { warnings.push(`Question ${question.id} contains an invalid Scripture reference.`); }
  }
  for (const quiz of typed.data.customQuizzes) for (const id of quiz.questionIds) if (!questionIds(id)) errors.push(`Generated quiz ${quiz.id} references missing question ${id}.`);
  const quizIds = new Set([...existing.customQuizzes, ...typed.data.customQuizzes].map(record => record.id));
  for (const session of typed.data.sessions) if (!quizIds.has(session.quizId)) errors.push(`Practice session ${session.id} references missing quiz ${session.quizId}.`);
  return { valid: errors.length === 0, errors, warnings, conflicts, counts: typed.manifest.counts, idRemapping };
}

function openQuizDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(QUIZ_DB_NAME, 3);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('sessions')) { const store = db.createObjectStore('sessions', { keyPath: 'id' }); store.createIndex('by-quiz', 'quizId'); }
      if (!db.objectStoreNames.contains('customQuizzes')) { const store = db.createObjectStore('customQuizzes', { keyPath: 'id' }); store.createIndex('by-updated', 'updatedAt'); }
      if (!db.objectStoreNames.contains('coveragePresets')) { const store = db.createObjectStore('coveragePresets', { keyPath: 'id' }); store.createIndex('by-updated', 'updatedAt'); }
      if (!db.objectStoreNames.contains('userCollections')) { const store = db.createObjectStore('userCollections', { keyPath: 'id' }); store.createIndex('by-updated', 'updatedAt'); }
      if (!db.objectStoreNames.contains('userQuestions')) { const store = db.createObjectStore('userQuestions', { keyPath: 'id' }); store.createIndex('by-collection', 'collectionId'); }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readStore(db: IDBDatabase, store: StoreName): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => { const request = db.transaction(store).objectStore(store).getAll(); request.onsuccess = () => resolve(request.result as Record<string, unknown>[]); request.onerror = () => reject(request.error); });
}

export async function readQuizData(): Promise<QuizDataSnapshot> {
  const db = await openQuizDatabase();
  const [sessions, customQuizzes, coveragePresets, userCollections, userQuestions] = await Promise.all(STORES.map(store => readStore(db, store)));
  db.close();
  return { sessions: sessions as PracticeSessionRecord[], customQuizzes: customQuizzes as CustomQuizRecord[], coveragePresets: coveragePresets as CoveragePresetRecord[], userCollections: userCollections as QuizCollectionRecord[], userQuestions: userQuestions as QuizQuestionRecord[] };
}

export async function exportMigrationBundle(metadata: { sourceSchemaVersion?: number; catalogId?: string; catalogVersion?: string; exportedAt?: string } = {}) {
  return createMigrationBundle(await readQuizData(), metadata);
}

export async function commitMigration(bundle: unknown, policy: ConflictPolicy = 'skip-existing'): Promise<MigrationPreview> {
  const existing = await readQuizData(); const preview = previewMigration(bundle, existing, policy);
  if (!preview.valid) throw new Error(`Migration validation failed: ${preview.errors.join(' ')}`);
  const typed = bundle as QuizMigrationBundle; const db = await openQuizDatabase(); const data = storeData(typed.data);
  const recordsToWrite = STORES.flatMap(store => data[store].map(record => ({ store, record: remapRecord(record, store, preview.idRemapping) })));
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([...STORES], 'readwrite');
    transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error ?? new Error('Migration transaction failed.')); transaction.onabort = () => reject(transaction.error ?? new Error('Migration transaction aborted.'));
    for (const { store, record } of recordsToWrite) {
      const conflict = preview.conflicts.some(item => item.store === store && item.id === record.id);
      if (conflict && policy === 'skip-existing') continue;
      transaction.objectStore(store).put(record);
    }
  }).finally(() => db.close());
  return preview;
}
