import type { ScriptureVerse } from './types';

export function findVerseByReference(verses: ScriptureVerse[], book: string, chapter: number, verse: number): ScriptureVerse | undefined {
  return verses.find(item => item.book === book && item.chapter === chapter && item.verse === verse);
}

export function getAdjacentVerse(verses: ScriptureVerse[], current: ScriptureVerse, direction: 'previous' | 'next'): ScriptureVerse | undefined {
  const step = direction === 'next' ? 1 : -1;
  // Packs do not carry authoritative chapter-length metadata. Only follow an
  // exact adjacent reference that is present; never infer a chapter boundary
  // from the highest verse in a partial study pack.
  return findVerseByReference(verses, current.book, current.chapter, current.verse + step);
}

export interface SurroundingContext { previous: ScriptureVerse[]; selected: ScriptureVerse; next: ScriptureVerse[]; previousUnavailable: boolean; nextUnavailable: boolean; }

export function resolveSurroundingContext(verses: ScriptureVerse[], selected: ScriptureVerse, depth = 2): SurroundingContext {
  const previous: ScriptureVerse[] = [];
  const next: ScriptureVerse[] = [];
  let cursor = selected;
  for (let index = 0; index < depth; index += 1) { const neighbor = getAdjacentVerse(verses, cursor, 'previous'); if (!neighbor) break; previous.unshift(neighbor); cursor = neighbor; }
  cursor = selected;
  for (let index = 0; index < depth; index += 1) { const neighbor = getAdjacentVerse(verses, cursor, 'next'); if (!neighbor) break; next.push(neighbor); cursor = neighbor; }
  return { previous, selected, next, previousUnavailable: previous.length < depth, nextUnavailable: next.length < depth };
}

export function toggleComparison(ids: string[], id: string, max = 4): string[] {
  if (ids.includes(id)) return ids.filter(item => item !== id);
  return ids.length >= max ? ids : [...ids, id];
}

