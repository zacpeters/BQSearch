import { bookChapters, normalizeBookName } from '../material/books';
import { getDivisionStudyNumber, projectVersesForDivision } from '../division';
import type { Division, ScripturePack, ScriptureVerse } from '../types';
import type { NormalizedScriptureReference, ResolvedScriptureVerse, ScriptureLookupResult, ScriptureProvider, ScriptureProviderContext, ScriptureReference } from './contracts';

const BOOK_ORDER = new Map(Object.keys(bookChapters).map((book, index) => [book, index]));

export function normalizeScriptureReference(reference: ScriptureReference): NormalizedScriptureReference {
  const book = normalizeBookName(reference.book);
  if (!book || !Number.isInteger(reference.chapter) || !Number.isInteger(reference.startVerse) || reference.chapter < 1 || reference.startVerse < 1) {
    throw new Error('Invalid Scripture reference.');
  }
  if (reference.endVerse !== undefined && (!Number.isInteger(reference.endVerse) || reference.endVerse < reference.startVerse)) throw new Error('Invalid Scripture verse range.');
  const maxChapter = bookChapters[book];
  if (reference.chapter > maxChapter) throw new Error(`Invalid chapter for ${book}.`);
  return { ...reference, book, endVerse: reference.endVerse };
}

export function compareScriptureReferences(a: ScriptureReference, b: ScriptureReference): number {
  const left = normalizeScriptureReference(a); const right = normalizeScriptureReference(b);
  return (BOOK_ORDER.get(left.book) ?? Number.MAX_SAFE_INTEGER) - (BOOK_ORDER.get(right.book) ?? Number.MAX_SAFE_INTEGER)
    || left.chapter - right.chapter || left.startVerse - right.startVerse;
}

function canonicalOrder(reference: ScriptureReference) {
  const normalized = normalizeScriptureReference(reference);
  return ((BOOK_ORDER.get(normalized.book) ?? 0) * 1000000) + (normalized.chapter * 1000) + normalized.startVerse;
}

function packIdentity(pack: ScripturePack) {
  return { id: pack.id, version: pack.version, schemaVersion: pack.schemaVersion, seasonId: pack.season.id, source: pack.source };
}

function unavailable(pack: ScripturePack, reference: NormalizedScriptureReference, reason: ScriptureLookupResult['reason']): ScriptureLookupResult {
  return { reference, available: false, verses: [], pack: packIdentity(pack), reason };
}

export function createPackScriptureProvider(pack: ScripturePack, context: ScriptureProviderContext): ScriptureProvider {
  const projected = projectVersesForDivision(pack.verses, context.division).sort((a, b) => getDivisionStudyNumber(a, context.division)! - getDivisionStudyNumber(b, context.division)!);
  const byReference = new Map(projected.map(verse => [`${verse.book}|${verse.chapter}|${verse.verse}`, verse]));
  const minStudy = context.studyStart;
  const maxStudy = context.studyEnd === 999 ? Number.POSITIVE_INFINITY : context.studyEnd;

  const resolve = (reference: ScriptureReference): ScriptureLookupResult => {
    let normalized: NormalizedScriptureReference;
    try { normalized = normalizeScriptureReference(reference); } catch { return unavailable(pack, { ...reference, book: reference.book }, 'invalid-reference'); }
    const endVerse = normalized.endVerse ?? normalized.startVerse;
    const verses: ResolvedScriptureVerse[] = [];
    for (let verseNumber = normalized.startVerse; verseNumber <= endVerse; verseNumber += 1) {
      const verse = byReference.get(`${normalized.book}|${normalized.chapter}|${verseNumber}`);
      if (!verse) {
        const existsInPack = pack.verses.some(candidate => candidate.book === normalized.book && candidate.chapter === normalized.chapter && candidate.verse === verseNumber);
        return unavailable(pack, normalized, existsInPack ? 'outside-division' : 'missing-verse');
      }
      const studyNumber = getDivisionStudyNumber(verse, context.division);
      if (studyNumber === null) return unavailable(pack, normalized, 'outside-division');
      if (minStudy !== undefined && studyNumber < minStudy || maxStudy !== undefined && studyNumber > maxStudy) return unavailable(pack, normalized, 'outside-study-range');
      verses.push({ verse, canonicalOrder: canonicalOrder({ book: normalized.book, chapter: normalized.chapter, startVerse: verseNumber }), studyNumber });
    }
    return { reference: normalized, available: true, text: verses.map(item => item.verse.text).join('\n'), verses, pack: packIdentity(pack) };
  };

  return {
    async getVerse(reference) { return resolve(reference); },
    async getVerses(references) { return references.map(resolve); },
    getByStudyNumber(studyNumber) {
      const verse = projected.find(candidate => getDivisionStudyNumber(candidate, context.division) === studyNumber && (minStudy === undefined || studyNumber >= minStudy) && (maxStudy === undefined || studyNumber <= maxStudy));
      if (!verse) return undefined;
      return resolve({ book: verse.book, chapter: verse.chapter, startVerse: verse.verse });
    },
  };
}

export function packReferenceKey(reference: ScriptureReference) {
  const normalized = normalizeScriptureReference(reference);
  return `${normalized.book}|${normalized.chapter}|${normalized.startVerse}|${normalized.endVerse ?? normalized.startVerse}`;
}
