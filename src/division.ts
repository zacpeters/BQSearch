import type { Division, ScripturePack, ScriptureVerse } from './types';

const hasOwn = (value: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value, key);

/**
 * Returns the study number for one division without interpreting another
 * division's number. Packs without studyNumbers are legacy packs and use the
 * single studyNumber for every listed division.
 */
export function getDivisionStudyNumber(verse: ScriptureVerse, division: Division): number | null {
  if (!verse.divisions.includes(division)) return null;
  if (verse.studyNumbers) {
    if (!hasOwn(verse.studyNumbers, division)) return null;
    const number = verse.studyNumbers[division];
    return typeof number === 'number' && Number.isInteger(number) && number > 0 ? number : null;
  }
  return Number.isInteger(verse.studyNumber) && verse.studyNumber > 0 ? verse.studyNumber : null;
}

/** Create the public search projection for one active division. */
export function projectVersesForDivision(verses: ScriptureVerse[], division: Division): ScriptureVerse[] {
  return verses.flatMap((verse) => {
    const studyNumber = getDivisionStudyNumber(verse, division);
    return studyNumber === null ? [] : [{ ...verse, studyNumber }];
  });
}

export function getDivisionStudyRange(verses: ScriptureVerse[], division: Division): { min: number; max: number } {
  const projected = projectVersesForDivision(verses, division);
  if (!projected.length) return { min: 0, max: 0 };
  return projected.reduce((range, verse) => ({ min: Math.min(range.min, verse.studyNumber), max: Math.max(range.max, verse.studyNumber) }), { min: Infinity, max: 0 });
}

export function resolveStudyRange(availableVerses: ScriptureVerse[], requestedStart: number, requestedEnd: number): { start: number; end: number; all: boolean } {
  const available = [...availableVerses].sort((a, b) => a.studyNumber - b.studyNumber);
  if (!available.length) return { start: 0, end: 0, all: true };
  const min = available[0].studyNumber;
  const max = available[available.length - 1].studyNumber;
  const start = Math.max(min, Math.min(Number.isFinite(requestedStart) ? requestedStart : min, max));
  const end = requestedEnd === 999 ? max : Math.max(start, Math.min(Number.isFinite(requestedEnd) ? requestedEnd : max, max));
  const count = available.filter(verse => verse.studyNumber >= start && verse.studyNumber <= end).length;
  return { start, end, all: count === available.length };
}

/** Validation errors for division membership/number mappings in a pack. */
export function validateDivisionStudyNumbers(pack: ScripturePack): string[] {
  const errors: string[] = [];
  for (const verse of pack.verses) {
    for (const division of verse.divisions) {
      if (getDivisionStudyNumber(verse, division) === null) {
        errors.push(`${verse.book} ${verse.chapter}:${verse.verse} is missing a valid study number for ${division}.`);
      }
    }
    for (const mappedDivision of Object.keys(verse.studyNumbers ?? {})) {
      if (!verse.divisions.includes(mappedDivision as Division)) {
        errors.push(`${verse.book} ${verse.chapter}:${verse.verse} has an unsupported study number mapping for ${mappedDivision}.`);
      }
    }
  }
  return errors;
}

