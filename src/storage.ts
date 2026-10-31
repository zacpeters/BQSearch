import type { ScripturePack, TournamentSettings } from './types';
const DB_NAME = 'scripture-lookup'; const DB_VERSION = 1;
function openDb(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const req = indexedDB.open(DB_NAME, DB_VERSION); req.onupgradeneeded = () => { req.result.createObjectStore('packs', { keyPath: 'id' }); req.result.createObjectStore('settings', { keyPath: 'id' }); }; req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
export async function savePack(pack: ScripturePack) { const db = await openDb(); return new Promise<void>((resolve, reject) => { const req = db.transaction('packs','readwrite').objectStore('packs').put(pack); req.onsuccess = () => resolve(); req.onerror = () => reject(req.error); }); }
export async function getPacks(): Promise<ScripturePack[]> { const db = await openDb(); return new Promise((resolve, reject) => { const req = db.transaction('packs').objectStore('packs').getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
export async function saveSettings(settings: TournamentSettings) { const db = await openDb(); return new Promise<void>((resolve, reject) => { const req = db.transaction('settings','readwrite').objectStore('settings').put({ ...settings, id: 'current' }); req.onsuccess = () => resolve(); req.onerror = () => reject(req.error); }); }
export async function getSettings(): Promise<TournamentSettings | undefined> { const db = await openDb(); return new Promise((resolve, reject) => { const req = db.transaction('settings').objectStore('settings').get('current'); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
export async function downloadPack(url: string): Promise<ScripturePack> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Pack download failed: ${response.status}`);
  const pack = await response.json() as ScripturePack;
  if (!pack.id || !pack.schemaVersion || !pack.season || !Array.isArray(pack.verses)) throw new Error('Invalid Scripture pack');
  await savePack(pack);
  return pack;
}
