import { bookChapters } from './material/books';
import type { SearchKind, SearchQuery, SearchResult, ScriptureVerse } from './types';

const bookAliases: Record<string, string> = {
  gen: 'Genesis', ge: 'Genesis', ex: 'Exodus', exo: 'Exodus', lev: 'Leviticus', le: 'Leviticus', num: 'Numbers', nu: 'Numbers', nm: 'Numbers', deut: 'Deuteronomy', de: 'Deuteronomy', dt: 'Deuteronomy', jos: 'Joshua', josh: 'Joshua', judg: 'Judges', jdg: 'Judges', ru: 'Ruth',
  '1sa': '1 Samuel', '1sam': '1 Samuel', '2sa': '2 Samuel', '2sam': '2 Samuel', '1ki': '1 Kings', '1kgs': '1 Kings', '2ki': '2 Kings', '2kgs': '2 Kings', '1ch': '1 Chronicles', '1chr': '1 Chronicles', '2ch': '2 Chronicles', '2chr': '2 Chronicles', ezr: 'Ezra', neh: 'Nehemiah', ne: 'Nehemiah', est: 'Esther',
  ps: 'Psalms', psa: 'Psalms', psalm: 'Psalms', psalms: 'Psalms', prov: 'Proverbs', prv: 'Proverbs', pro: 'Proverbs', eccl: 'Ecclesiastes', ecc: 'Ecclesiastes', qoh: 'Ecclesiastes', song: 'Song of Solomon', sos: 'Song of Solomon', cant: 'Song of Solomon', isa: 'Isaiah', jer: 'Jeremiah', lam: 'Lamentations', ezek: 'Ezekiel', eze: 'Ezekiel', dan: 'Daniel', hos: 'Hosea', joe: 'Joel', amo: 'Amos', obad: 'Obadiah', ob: 'Obadiah', jon: 'Jonah', mic: 'Micah', nah: 'Nahum', hab: 'Habakkuk', zeph: 'Zephaniah', zep: 'Zephaniah', hag: 'Haggai', zec: 'Zechariah', zech: 'Zechariah', mal: 'Malachi',
  matt: 'Matthew', mat: 'Matthew', mt: 'Matthew', mk: 'Mark', mrk: 'Mark', mar: 'Mark', lk: 'Luke', luk: 'Luke', lu: 'Luke', john: 'John', joh: 'John', jn: 'John', acts: 'Acts', act: 'Acts', rom: 'Romans', romans: 'Romans', ro: 'Romans',
  '1co': '1 Corinthians', '1cor': '1 Corinthians', '2co': '2 Corinthians', '2cor': '2 Corinthians', gal: 'Galatians', ga: 'Galatians', eph: 'Ephesians', ep: 'Ephesians', phil: 'Philippians', php: 'Philippians', ph: 'Philippians', col: 'Colossians',
  '1th': '1 Thessalonians', '1thes': '1 Thessalonians', '2th': '2 Thessalonians', '2thes': '2 Thessalonians', '1ti': '1 Timothy', '1tim': '1 Timothy', '2ti': '2 Timothy', '2tim': '2 Timothy', tit: 'Titus', ti: 'Titus', phm: 'Philemon', philem: 'Philemon', heb: 'Hebrews', he: 'Hebrews', jas: 'James', jam: 'James', ja: 'James',
  '1pe': '1 Peter', '1pet': '1 Peter', '2pe': '2 Peter', '2pet': '2 Peter', '1jo': '1 John', '1jn': '1 John', '2jo': '2 John', '2jn': '2 John', '3jo': '3 John', '3jn': '3 John', jude: 'Jude', jud: 'Jude', rev: 'Revelation', re: 'Revelation', apo: 'Revelation',
};

const clean = (value: string) => value.toLocaleLowerCase().replace(/[“”"']/g, '').replace(/\s+/g, ' ').trim();
const compact = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const canonicalBooks = Object.keys(bookChapters);
const bookNames = [...new Set([...canonicalBooks, ...Object.keys(bookAliases)])].sort((a, b) => compact(b).length - compact(a).length);
const aliasesByCompactName = new Map<string, string>();
for (const book of canonicalBooks) aliasesByCompactName.set(compact(book), book);
for (const [alias, book] of Object.entries(bookAliases)) aliasesByCompactName.set(compact(alias), book);

export interface ParsedReference { book?: string; chapter: number; verse: number; endVerse?: number; bare: boolean; }

function parseReferencePart(raw: string): ParsedReference | null {
  const value = clean(raw);
  const bare = value.match(/^(\d+)\s*(?::|\.|\s+)\s*(\d+)(?:\s*-\s*(\d+))?$/);
  if (bare) return { chapter: Number(bare[1]), verse: Number(bare[2]), endVerse: bare[3] ? Number(bare[3]) : undefined, bare: true };
  for (const name of bookNames) {
    const key = compact(name);
    const pattern = key.split('').map(escaped).join('\\s*');
    const match = value.match(new RegExp(`^${pattern}\\s*(\\d+)\\s*(?::|\\.)\\s*(\\d+)(?:\\s*-\\s*(\\d+))?$`));
    if (match) return { book: aliasesByCompactName.get(key) ?? name, chapter: Number(match[1]), verse: Number(match[2]), endVerse: match[3] ? Number(match[3]) : undefined, bare: false };
    const spaced = value.match(new RegExp(`^${pattern}\\s*(\\d+)\\s+(\\d+)(?:\\s*-\\s*(\\d+))?$`));
    if (spaced) return { book: aliasesByCompactName.get(key) ?? name, chapter: Number(spaced[1]), verse: Number(spaced[2]), endVerse: spaced[3] ? Number(spaced[3]) : undefined, bare: false };
  }
  return null;
}

export function parseReferenceQuery(raw: string): ParsedReference | null {
  if (!raw.trim() || /["“”']/.test(raw)) return null;
  return parseReferencePart(raw);
}

export function parseSearch(raw: string): SearchQuery {
  const normalized = clean(raw);
  if (normalized.startsWith('start:') || normalized.endsWith('*')) return { raw, normalized: normalized.replace(/^start:/, '').replace(/\*$/, '').trim(), kind: 'verse-start' };
  if (/^\d+$/.test(normalized)) return { raw, normalized, kind: 'study-number' };
  if (/^#?\d+\s*-\s*#?\d+$/.test(normalized)) return { raw, normalized, kind: 'study-number' };
  if (parseReferenceQuery(raw)) return { raw, normalized, kind: 'reference' };
  if (/^".*"$/.test(raw.trim()) || normalized.includes(' ')) return { raw, normalized: normalized.replace(/^"|"$/g, ''), kind: raw.trim().startsWith('"') ? 'phrase' : 'all' };
  return { raw, normalized, kind: 'word' };
}

function referenceFor(query: ParsedReference, verse: ScriptureVerse) {
  if (query.book && clean(query.book) !== clean(verse.book)) return false;
  return verse.chapter === query.chapter && verse.verse >= query.verse && (!query.endVerse || verse.verse <= query.endVerse);
}

export function searchVerses(verses: ScriptureVerse[], raw: string): SearchResult[] {
  const query = parseSearch(raw); if (!query.normalized) return [];
  const parsedReference = query.kind === 'reference' ? parseReferenceQuery(raw) : null;
  return verses.filter(v => {
    if (query.kind === 'study-number') { const range = query.normalized.replace(/#/g, '').split('-').map(Number); return range.length === 1 ? v.studyNumber === range[0] : v.studyNumber >= range[0] && v.studyNumber <= range[1]; }
    if (query.kind === 'reference' && parsedReference) return referenceFor(parsedReference, v);
    const text = clean(`${v.book} ${v.text}`); return query.kind === 'phrase' ? text.includes(query.normalized) : query.kind === 'verse-start' ? clean(v.text).startsWith(query.normalized) : query.normalized.split(' ').every(word => text.includes(word));
  }).map(verse => ({ verse, match: query.kind === 'all' ? 'word' : query.kind, excerpt: verse.text }));
}
