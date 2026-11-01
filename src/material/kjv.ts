import { canonicalReference, normalizeBookName } from './books';
import type { KJVCorpus } from './types';

const key = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();
export function parseKJVJson(input: string): KJVCorpus {
  const parsed = JSON.parse(input) as Record<string, unknown> | Array<Record<string, unknown>>; const entries: Record<string, string> = {};
  for (const [rawKey, rawValue] of Array.isArray(parsed) ? parsed.map(row => [`${row.book} ${row.chapter}:${row.verse}`, row.text] as [string, unknown]) : Object.entries(parsed)) { if (typeof rawValue !== 'string') continue; const match = rawKey.match(/^(.+?)\s+(\d+):(\d+)$/); const book = match && normalizeBookName(match[1]); if (match && book) entries[key(canonicalReference(book, Number(match[2]), Number(match[3])))] = rawValue.trim(); }
  return corpusFromEntries(entries, 'eBible KJV JSON / local cached corpus');
}
export function parseKJVText(input: string): KJVCorpus {
  if (input.trim().startsWith('{') || input.trim().startsWith('[')) return parseKJVJson(input);
  const entries: Record<string, string> = {}; let currentBook = ''; let currentChapter = 0;
  for (const line of input.split(/\r?\n/)) { const usfmId = line.match(/^\\id\s+([^\s]+)/); if (usfmId) { currentBook = normalizeBookName(usfmfBook(usfmId[1])) ?? ''; continue; } const chapter = line.match(/^\\c\s+(\d+)/); if (chapter) { currentChapter = Number(chapter[1]); continue; } const verse = line.match(/^\\v\s+(\d+)\s+(.+)/); if (verse && currentBook && currentChapter) entries[key(canonicalReference(currentBook, currentChapter, Number(verse[1])))] = verse[2].replace(/\\[a-z]+\*?/g, '').replace(/\s+/g, ' ').trim(); const plain = line.match(/^(.+?)\s+(\d+):(\d+)\s*[|\t]\s*(.+)$/); if (plain) { const book = normalizeBookName(plain[1]); if (book) entries[key(canonicalReference(book, Number(plain[2]), Number(plain[3])))] = plain[4].trim(); } }
  return corpusFromEntries(entries, 'Local KJV text corpus');
}
function usfmfBook(value: string) { const ids: Record<string, string> = { GEN:'Genesis', EXO:'Exodus', LEV:'Leviticus', NUM:'Numbers', DEU:'Deuteronomy', JOS:'Joshua', JDG:'Judges', RUT:'Ruth', PSA:'Psalms', MAT:'Matthew', MRK:'Mark', LUK:'Luke', JHN:'John', ACT:'Acts', ROM:'Romans', REV:'Revelation' }; return ids[value.toUpperCase()] ?? value; }
function corpusFromEntries(entries: Record<string, string>, sourceName: string): KJVCorpus { let hash = 2166136261; for (const char of JSON.stringify(entries)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619); return { get: reference => entries[key(reference)], checksum: (hash >>> 0).toString(16).padStart(8, '0'), sourceName, license: 'Public domain in the United States; review UK printing restrictions.' }; }
export async function fetchKJVCorpus(url: string, fetcher: typeof fetch = fetch): Promise<KJVCorpus> { const response = await fetcher(url); if (!response.ok) throw new Error(`KJV corpus request failed with HTTP ${response.status}. Download a supported local corpus instead.`); const text = await response.text(); try { return url.toLowerCase().endsWith('.json') ? parseKJVJson(text) : parseKJVText(text); } catch (error) { throw new Error(`KJV corpus could not be parsed: ${error instanceof Error ? error.message : String(error)}`); } }
