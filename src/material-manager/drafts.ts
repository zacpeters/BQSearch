import type { Division } from '../types';
import type { ImportSourceFile } from '../material/types';

const DB_NAME = 'bq-search-material-manager';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';
const DRAFT_ID = 'active';

export interface MaterialDraftSnapshot {
  id: typeof DRAFT_ID;
  savedAt: string;
  input: string;
  format: 'auto' | 'txt' | 'csv' | 'json';
  sourceFiles: ImportSourceFile[];
  corpusText: string;
  corrections: Record<string, string>;
  retrieved: Record<string, { text: string; source: 'api' | 'cache' }>;
  pack: { id: string; title: string; version: string; seasonId: string; seasonName: string; year: number };
  importDivision: Division;
}

export interface MaterialDraftBackup { format: 'bq-search-material-draft'; version: 1; draft: Omit<MaterialDraftSnapshot, 'id'>; }
export function materialDraftBackupJson(snapshot: Omit<MaterialDraftSnapshot, 'id' | 'savedAt'>): string { return JSON.stringify({ format: 'bq-search-material-draft', version: 1, draft: { ...snapshot, savedAt: new Date().toISOString() } }, null, 2); }
export function parseMaterialDraftBackup(value: unknown): Omit<MaterialDraftSnapshot, 'id'> { const parsed = value as Partial<MaterialDraftBackup> | null; if (!parsed || parsed.format !== 'bq-search-material-draft' || parsed.version !== 1 || !parsed.draft || typeof parsed.draft !== 'object') throw new Error('Invalid or unsupported draft backup.'); return parsed.draft as Omit<MaterialDraftSnapshot, 'id'>; }

function openDraftDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open Material Manager drafts.'));
  });
}

export async function saveMaterialDraft(snapshot: Omit<MaterialDraftSnapshot, 'id' | 'savedAt'>): Promise<void> {
  const db = await openDraftDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put({ ...snapshot, id: DRAFT_ID, savedAt: new Date().toISOString() });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Could not save Material Manager draft.'));
  });
  db.close();
}

export async function getMaterialDraft(): Promise<MaterialDraftSnapshot | undefined> {
  const db = await openDraftDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(DRAFT_ID);
    request.onsuccess = () => { db.close(); resolve(request.result as MaterialDraftSnapshot | undefined); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function discardMaterialDraft(): Promise<void> {
  const db = await openDraftDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(DRAFT_ID);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}

export const MATERIAL_MANAGER_OPTIONS_KEY = 'bq-search-material-manager-options-v1';

export interface MaterialManagerOptions {
  format: 'auto' | 'txt' | 'csv' | 'json';
  importDivision: Division;
  year: number;
}

export function loadMaterialManagerOptions(): Partial<MaterialManagerOptions> {
  try {
    const raw = localStorage.getItem(MATERIAL_MANAGER_OPTIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<MaterialManagerOptions>;
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function saveMaterialManagerOptions(options: MaterialManagerOptions): void {
  try { localStorage.setItem(MATERIAL_MANAGER_OPTIONS_KEY, JSON.stringify(options)); } catch { /* Storage may be unavailable in private browsing. */ }
}
