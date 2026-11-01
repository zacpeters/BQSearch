import { describe, expect, it } from 'vitest';
import { parseReferenceQuery, parseSearch, searchVerses } from './search';
import type { ScriptureVerse } from './types';

const verse = (id: string, book: string, chapter: number, verseNumber: number, studyNumber: number, text = 'A familiar verse text.') : ScriptureVerse => ({ id, book, chapter, verse: verseNumber, studyNumber, divisions: ['Beginner'], text });
const referenceFixture: ScriptureVerse[] = [
  verse('psalm-8-3', 'Psalms', 8, 3, 11, 'When I consider thy heavens, the work of thy fingers.'),
  verse('john-8-3', 'John', 8, 3, 12, 'And the scribes and Pharisees brought unto him a woman.'),
  verse('first-corinthians-13-4', '1 Corinthians', 13, 4, 13),
  verse('second-timothy-1-7', '2 Timothy', 1, 7, 14),
];

describe('reference parsing and search', () => {
  it('supports Psalms full, abbreviated, compact, and case-insensitive forms', () => {
    for (const query of ['Psalms 8:3', 'Psalm 8:3', 'Ps 8:3', 'Psa 8:3', 'ps8:3', 'ps8.3', 'psa8 3', 'ps 8 3', 'PS 8:3']) {
      expect(parseReferenceQuery(query)).toMatchObject({ book: 'Psalms', chapter: 8, verse: 3, bare: false });
      expect(searchVerses(referenceFixture, query).map(result => result.verse.id)).toEqual(['psalm-8-3']);
    }
  });

  it('supports standard aliases and numbered books', () => {
    expect(searchVerses(referenceFixture, 'Jn 8:3')[0].verse.book).toBe('John');
    expect(searchVerses(referenceFixture, '1 Cor 13:4')[0].verse.book).toBe('1 Corinthians');
    expect(searchVerses(referenceFixture, '1cor13.4')[0].verse.book).toBe('1 Corinthians');
    expect(searchVerses(referenceFixture, '2 Tim 1 7')[0].verse.book).toBe('2 Timothy');
    expect(parseReferenceQuery('1 John 3:16')).toMatchObject({ book: '1 John', chapter: 3, verse: 16 });
  });

  it('resolves bare references and returns all ambiguous candidates', () => {
    expect(parseSearch('8:3').kind).toBe('reference');
    expect(searchVerses(referenceFixture, '8:3').map(result => result.verse.book)).toEqual(['Psalms', 'John']);
    expect(searchVerses(referenceFixture, '8.3').map(result => result.verse.book)).toEqual(['Psalms', 'John']);
    expect(searchVerses(referenceFixture, '8 3').map(result => result.verse.book)).toEqual(['Psalms', 'John']);
  });

  it('does not fall back to text search for a recognized reference with no match', () => {
    expect(parseSearch('Psalms 99:99').kind).toBe('reference');
    expect(searchVerses(referenceFixture, 'Psalms 99:99')).toEqual([]);
    expect(parseSearch('8:99').kind).toBe('reference');
    expect(searchVerses(referenceFixture, '8:99')).toEqual([]);
  });

  it('rejects malformed references without classifying ordinary text as references', () => {
    for (const query of ['Psalms', 'Psalms 8', 'Psalms eight:3', 'not a reference', 'word 8:3']) {
      expect(parseReferenceQuery(query)).toBeNull();
    }
    expect(parseSearch('word 8:3').kind).toBe('all');
    expect(parseSearch('faith').kind).toBe('word');
  });

  it('preserves existing study, phrase, word, and verse-start modes', () => {
    const verses = [...referenceFixture, verse('phrase', 'John', 3, 16, 15, 'For God so loved the world.')];
    expect(parseSearch('1-4').kind).toBe('study-number');
    expect(searchVerses(verses, '11-12')).toHaveLength(2);
    expect(parseSearch('"loved the world"').kind).toBe('phrase');
    expect(searchVerses(verses, '"loved the world"')).toHaveLength(1);
    expect(searchVerses(verses, 'world')).toHaveLength(1);
    expect(parseSearch('start:For God').kind).toBe('verse-start');
    expect(searchVerses(verses, 'start:For God')).toHaveLength(1);
  });

  it('respects the already projected division and study-range input', () => {
    const projected = referenceFixture.map((item, index) => ({ ...item, studyNumber: index + 1 }));
    expect(searchVerses(projected.filter(item => item.studyNumber >= 2 && item.studyNumber <= 3), '8:3').map(result => result.verse.book)).toEqual(['John']);
    expect(searchVerses(projected.filter(item => item.studyNumber >= 3 && item.studyNumber <= 3), '8:3')).toEqual([]);
    expect(searchVerses(projected.filter(item => item.studyNumber >= 1 && item.studyNumber <= 1), '8:3')[0].verse.studyNumber).toBe(1);
  });
});

