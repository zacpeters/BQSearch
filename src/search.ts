import { bookChapters } from './material/books';
import { tokenizeScripture } from './tokenize';
import type { SearchQuery, SearchResult, ScriptureVerse } from './types';

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

export interface ParsedReference { book?: string; chapter: number; verse?: number; endVerse?: number; bare: boolean; }
export type ReferenceInputStatus = 'complete' | 'chapter' | 'incomplete' | 'invalid' | 'none';
export interface ReferenceInput { status: ReferenceInputStatus; reference?: ParsedReference; }

function bookPattern(name: string) { return compact(name).split('').map(escaped).join('\\s*'); }

function parseReferencePart(raw: string): ParsedReference | null {
  const value = clean(raw);
  const bare = value.match(/^(\d+)\s*(?::|\.|\s+)\s*(\d+)(?:\s*-\s*(\d+))?$/);
  if (bare) return { chapter: Number(bare[1]), verse: Number(bare[2]), endVerse: bare[3] ? Number(bare[3]) : undefined, bare: true };
  for (const name of bookNames) {
    const pattern = bookPattern(name);
    const match = value.match(new RegExp(`^${pattern}\\s*(\\d+)\\s*(?::|\\.)\\s*(\\d+)(?:\\s*-\\s*(\\d+))?$`));
    if (match) return { book: aliasesByCompactName.get(compact(name)) ?? name, chapter: Number(match[1]), verse: Number(match[2]), endVerse: match[3] ? Number(match[3]) : undefined, bare: false };
    const spaced = value.match(new RegExp(`^${pattern}\\s*(\\d+)\\s+(\\d+)(?:\\s*-\\s*(\\d+))?$`));
    if (spaced) return { book: aliasesByCompactName.get(compact(name)) ?? name, chapter: Number(spaced[1]), verse: Number(spaced[2]), endVerse: spaced[3] ? Number(spaced[3]) : undefined, bare: false };
  }
  return null;
}

export function parseReferenceQuery(raw: string): ParsedReference | null {
  if (!raw.trim() || /["“”']/.test(raw)) return null;
  const reference = parseReferencePart(raw);
  return reference?.verse === undefined || !validReference(reference) ? null : reference;
}

function validReference(reference: ParsedReference): boolean {
  return reference.chapter > 0 && (reference.verse === undefined || reference.verse > 0) && (reference.endVerse === undefined || (reference.endVerse > 0 && reference.verse !== undefined && reference.endVerse >= reference.verse));
}

export function classifyReferenceInput(raw: string): ReferenceInput {
  if (!raw.trim() || /["“”']/.test(raw)) return { status: 'none' };
  const parsedPart = parseReferencePart(raw);
  if (parsedPart && parsedPart.verse !== undefined && !validReference(parsedPart)) return { status: 'invalid' };
  const complete = parseReferenceQuery(raw);
  if (complete) return { status: 'complete', reference: complete };
  const value = clean(raw);
  const bareChapter = value.match(/^\d+$/);
  if (bareChapter) return Number(value) > 0 ? { status: 'chapter', reference: { chapter: Number(value), bare: true } } : { status: 'invalid' };
  for (const name of bookNames) {
    const pattern = bookPattern(name);
    const book = aliasesByCompactName.get(compact(name)) ?? name;
    const chapter = value.match(new RegExp(`^${pattern}\\s*(\\d+)(?::\\s*)?$`));
    if (chapter) return Number(chapter[1]) > 0 ? { status: 'chapter', reference: { book, chapter: Number(chapter[1]), bare: false } } : { status: 'invalid' };
    if (new RegExp(`^${pattern}(?:\\s*)$`).test(value)) return { status: 'incomplete' };
    if (value.startsWith(compact(name)) || value.startsWith(name.toLocaleLowerCase())) return { status: 'incomplete' };
  }
  return { status: 'none' };
}

export function parseSearch(raw: string): SearchQuery {
  const normalized = clean(raw);
  if (normalized.startsWith('end:')) return { raw, normalized: normalized.replace(/^end:/, '').trim(), kind: 'verse-end' };
  if (normalized.startsWith('start:') || normalized.endsWith('*')) return { raw, normalized: normalized.replace(/^start:/, '').replace(/\*$/, '').trim(), kind: 'verse-start' };
  if (/^(?:#|study:)\s*\d+(?:\s*-\s*#?\d+)?$/.test(normalized)) return { raw, normalized: normalized.replace(/^study:/, '').replace(/#/g, '').replace(/\s+/g, ''), kind: 'study-number' };
  const reference = classifyReferenceInput(raw);
  if (reference.status === 'complete') return { raw, normalized, kind: 'reference' };
  if (reference.status === 'chapter') return { raw, normalized, kind: 'reference-chapter' };
  if (reference.status === 'incomplete') return { raw, normalized, kind: 'reference-incomplete' };
  if (reference.status === 'invalid') return { raw, normalized, kind: 'reference-invalid' };
  if (!/^".*"$/.test(raw.trim())) {
    if (/^\S+\s+(?:and|or)\s+\S+$/i.test(normalized)) return { raw, normalized, kind: normalized.match(/\sand\s/i) ? 'word-and' : 'word-or' };
    if (/\s+(?:and|or)\s*$/i.test(normalized) || /\s+(?:and|or)\s+/i.test(normalized)) return { raw, normalized, kind: 'word-operator-incomplete' };
  }
  if (/^".*"$/.test(raw.trim()) || normalized.includes(' ')) return { raw, normalized: normalized.replace(/^"|"$/g, ''), kind: raw.trim().startsWith('"') ? 'phrase' : 'all' };
  return { raw, normalized, kind: 'word' };
}

function referenceFor(query: ParsedReference, verse: ScriptureVerse) {
  if (query.book && clean(query.book) !== clean(verse.book)) return false;
  if (verse.chapter !== query.chapter) return false;
  if (query.verse === undefined) return true;
  return query.endVerse === undefined ? verse.verse === query.verse : verse.verse >= query.verse && verse.verse <= query.endVerse;
}

export function searchVerses(verses: ScriptureVerse[], raw: string, options: { exactWord?: boolean } = {}): SearchResult[] {
  const query = parseSearch(raw); if (!query.normalized) return [];
  const classified = classifyReferenceInput(raw);
  const parsedReference = query.kind === 'reference' || query.kind === 'reference-chapter' ? classified.reference : null;
  return verses.filter(v => {
    if (query.kind === 'study-number') { const range = query.normalized.split('-').map(Number); return range.length === 1 ? v.studyNumber === range[0] : v.studyNumber >= range[0] && v.studyNumber <= range[1]; }
    if ((query.kind === 'reference' || query.kind === 'reference-chapter') && parsedReference) return referenceFor(parsedReference, v);
    if (query.kind === 'reference-incomplete' || query.kind === 'reference-invalid' || query.kind === 'word-operator-incomplete') return false;
    if (query.kind === 'word-and' || query.kind === 'word-or') {
      const operands = query.normalized.split(/\s+(?:and|or)\s+/i);
      const words = new Set(tokenizeScripture(v.text).map(token => token.normalized));
      return query.kind === 'word-and' ? operands.every(word => words.has(word)) : operands.some(word => words.has(word));
    }
    if (options.exactWord && query.kind === 'word') return tokenizeScripture(v.text).some(token => token.normalized === query.normalized);
    if (query.kind === 'verse-end') { const normalizeEnding = (value: string) => value.toLocaleLowerCase().replace(/[\p{P}\p{S}]+$/gu, '').trim().replace(/\s+/g, ' '); return normalizeEnding(v.text).endsWith(normalizeEnding(query.normalized)); }
    const text = clean(`${v.book} ${v.text}`); return query.kind === 'phrase' ? text.includes(query.normalized) : query.kind === 'verse-start' ? clean(v.text).startsWith(query.normalized) : query.normalized.split(' ').every(word => text.includes(word));
  }).map(verse => ({ verse, match: query.kind === 'all' ? 'word' : query.kind, excerpt: verse.text }));
}

export interface ReferenceSegmentFeedback { input: string; status: 'matched' | 'range-only' | 'missing' | 'incomplete' | 'invalid'; availableCount: number; visibleCount: number; }
export interface MultiReferenceSearch { results: SearchResult[]; feedback: ReferenceSegmentFeedback[]; }

function splitUnquoted(raw: string): string[] {
  const parts: string[] = []; let current = ''; let quoted = false;
  for (const character of raw) {
    if (character === '"') quoted = !quoted;
    if (!quoted && (character === ';' || character === ',')) { parts.push(current.trim()); current = ''; } else current += character;
  }
  parts.push(current.trim());
  return parts;
}

function referenceText(reference: ParsedReference): string {
  const book = reference.book ? `${reference.book} ` : '';
  return `${book}${reference.chapter}:${reference.verse}${reference.endVerse === undefined ? '' : `-${reference.endVerse}`}`;
}

/** Splits semicolon/comma lists and expands same-chapter verse shorthand. */
export function splitReferenceList(raw: string): string[] | null {
  if (raw.trim().startsWith('"') && raw.trim().endsWith('"')) return null;
  const parts = splitUnquoted(raw);
  if (parts.length < 2) return null;
  const expanded: string[] = []; let previous: ParsedReference | undefined; let hasReference = false;
  for (const part of parts) {
    const complete = parseReferenceQuery(part);
    if (complete) { expanded.push(part); previous = complete; hasReference = true; continue; }
    const shorthand = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (shorthand && previous?.verse !== undefined) { const reference = { ...previous, verse: Number(shorthand[1]), endVerse: shorthand[2] ? Number(shorthand[2]) : undefined }; expanded.push(referenceText(reference)); previous = reference; hasReference = true; continue; }
    expanded.push(part);
  }
  return hasReference ? expanded : null;
}

/** Evaluate semicolon-separated references in input order and deduplicate verses. */
export function searchMultipleReferences(allVerses: ScriptureVerse[], visibleVerses: ScriptureVerse[], raw: string): MultiReferenceSearch {
  const visibleIds = new Set(visibleVerses.map(verse => verse.id));
  const results: SearchResult[] = [];
  const feedback: ReferenceSegmentFeedback[] = [];
  const seen = new Set<string>();
  for (const input of (splitReferenceList(raw) ?? raw.split(';')).map(segment => segment.trim())) {
    if (!input) { feedback.push({ input, status: 'invalid', availableCount: 0, visibleCount: 0 }); continue; }
    const parsed = parseSearch(input);
    if (parsed.kind === 'reference-incomplete') { feedback.push({ input, status: 'incomplete', availableCount: 0, visibleCount: 0 }); continue; }
    if (parsed.kind !== 'reference' && parsed.kind !== 'reference-chapter') { feedback.push({ input, status: 'invalid', availableCount: 0, visibleCount: 0 }); continue; }
    const available = searchVerses(allVerses, input);
    const visible = available.filter(result => visibleIds.has(result.verse.id));
    feedback.push({ input, status: visible.length ? 'matched' : available.length ? 'range-only' : 'missing', availableCount: available.length, visibleCount: visible.length });
    for (const result of visible) if (!seen.has(result.verse.id)) { seen.add(result.verse.id); results.push(result); }
  }
  return { results, feedback };
}
