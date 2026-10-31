import type { SearchKind, SearchQuery, SearchResult, ScriptureVerse } from './types';

const aliases: Record<string, string> = { ps: 'Psalms', psa: 'Psalms', romans: 'Romans', ro: 'Romans', john: 'John', jn: 'John', phil: 'Philippians', php: 'Philippians', matt: 'Matthew', mt: 'Matthew', heb: 'Hebrews' };
const clean = (value: string) => value.toLocaleLowerCase().replace(/[“”"']/g, '').replace(/\s+/g, ' ').trim();
export function parseSearch(raw: string): SearchQuery {
  const normalized = clean(raw);
  if (normalized.startsWith('start:') || normalized.endsWith('*')) return { raw, normalized: normalized.replace(/^start:/, '').replace(/\*$/, '').trim(), kind: 'verse-start' };
  if (/^\d+$/.test(normalized)) return { raw, normalized, kind: 'study-number' };
  if (/^#?\d+\s*-\s*#?\d+$/.test(normalized)) return { raw, normalized, kind: 'study-number' };
  if (/^[a-z0-9 ]+\s+\d+[:.]\d+(-\d+)?$/i.test(normalized)) return { raw, normalized, kind: 'reference' };
  if (/^".*"$/.test(raw.trim()) || normalized.includes(' ')) return { raw, normalized: normalized.replace(/^"|"$/g, ''), kind: raw.trim().startsWith('"') ? 'phrase' : 'all' };
  return { raw, normalized, kind: 'word' };
}
function referenceFor(query: string, verse: ScriptureVerse) {
  const m = query.match(/^([a-z0-9 ]+)\s+(\d+):([0-9]+)(?:-([0-9]+))?$/i); if (!m) return false;
  const book = aliases[m[1].trim().toLowerCase()] ?? m[1].trim();
  return clean(book) === clean(verse.book) && verse.chapter === Number(m[2]) && verse.verse >= Number(m[3]) && (!m[4] || verse.verse <= Number(m[4]));
}
export function searchVerses(verses: ScriptureVerse[], raw: string): SearchResult[] {
  const query = parseSearch(raw); if (!query.normalized) return [];
  return verses.filter(v => {
    if (query.kind === 'study-number') { const range = query.normalized.replace(/#/g, '').split('-').map(Number); return range.length === 1 ? v.studyNumber === range[0] : v.studyNumber >= range[0] && v.studyNumber <= range[1]; }
    if (query.kind === 'reference') return referenceFor(query.normalized, v);
    const text = clean(`${v.book} ${v.text}`); return query.kind === 'phrase' ? text.includes(query.normalized) : query.kind === 'verse-start' ? clean(v.text).startsWith(query.normalized) : query.normalized.split(' ').every(word => text.includes(word));
  }).map(verse => ({ verse, match: query.kind === 'all' ? 'word' : query.kind, excerpt: verse.text }));
}
