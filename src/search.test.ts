import { describe, expect, it } from 'vitest';
import { parseReferenceQuery, parseSearch, searchMultipleReferences, searchVerses, splitReferenceList } from './search';
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
    expect(searchVerses([verse('a', 'Psalms', 3, 2, 1), verse('b', 'Psalms', 3, 3, 2), verse('c', 'Psalms', 3, 5, 3)], '3:2').map(result => result.verse.verse)).toEqual([2]);
    expect(searchVerses([verse('a', 'Psalms', 3, 2, 1), verse('b', 'Psalms', 3, 3, 2), verse('c', 'Psalms', 3, 5, 3)], '3.2').map(result => result.verse.verse)).toEqual([2]);
    expect(searchVerses([verse('a', 'Psalms', 3, 2, 1), verse('b', 'Psalms', 3, 3, 2), verse('c', 'Psalms', 3, 5, 3)], '3:2-5').map(result => result.verse.verse)).toEqual([2, 3, 5]);
  });

  it('reserves study lookup for explicit syntax and treats plain numbers as chapters', () => {
    expect(parseSearch('3').kind).toBe('reference-chapter');
    expect(parseSearch('#3').kind).toBe('study-number');
    expect(parseSearch('study:3').kind).toBe('study-number');
    expect(searchVerses([verse('psalm-3', 'Psalms', 3, 1, 40), verse('john-3', 'John', 3, 2, 41)], '3')).toHaveLength(2);
    expect(searchVerses([verse('study-three', 'John', 1, 1, 3)], '#3')).toHaveLength(1);
  });

  it('rejects zero, leading-zero, and reversed numeric references without broad matching', () => {
    const verses = [verse('psalm-3-2', 'Psalms', 3, 2, 3), verse('psalm-3-5', 'Psalms', 3, 5, 5), verse('psalm-23-1', 'Psalms', 23, 1, 23)];
    for (const query of ['0', '00', '999', '3:0', '3.0', '0:3', '3:5-2', '#0', 'study:0']) expect(searchVerses(verses, query)).toEqual([]);
    expect(parseSearch('0').kind).toBe('reference-invalid');
    expect(parseSearch('3:0').kind).toBe('reference-invalid');
    expect(searchVerses(verses, '3')).toHaveLength(2);
    expect(searchVerses(verses, '23')).toHaveLength(1);
    expect(searchVerses(verses, '3:2').map(result => result.verse.id)).toEqual(['psalm-3-2']);
    expect(searchVerses(verses, '3:2-5').map(result => result.verse.id)).toEqual(['psalm-3-2', 'psalm-3-5']);
  });

  it('classifies progressive references without falling back to word search', () => {
    expect(parseSearch('Psa').kind).toBe('reference-incomplete');
    expect(parseSearch('Psa ').kind).toBe('reference-incomplete');
    expect(parseSearch('Psa 3').kind).toBe('reference-chapter');
    expect(parseSearch('Psa 3:').kind).toBe('reference-chapter');
    expect(searchVerses(referenceFixture, 'Psa')).toEqual([]);
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
    expect(parseSearch('#1-4').kind).toBe('study-number');
    expect(parseSearch('study:11').kind).toBe('study-number');
    expect(searchVerses(verses, '#11-12')).toHaveLength(2);
    expect(parseSearch('"loved the world"').kind).toBe('phrase');
    expect(searchVerses(verses, '"loved the world"')).toHaveLength(1);
    expect(searchVerses(verses, 'world')).toHaveLength(1);
    expect(parseSearch('start:For God').kind).toBe('verse-start');
    expect(searchVerses(verses, 'start:For God')).toHaveLength(1);
    expect(parseSearch('end:the world').kind).toBe('verse-end');
    expect(searchVerses(verses, 'end:loved the world')).toHaveLength(1);
    expect(searchVerses([verse('punctuation', 'John', 3, 17, 16, 'For ever, the Lord!')], 'end:the Lord')).toHaveLength(1);
  });

  it('respects the already projected division and study-range input', () => {
    const projected = referenceFixture.map((item, index) => ({ ...item, studyNumber: index + 1 }));
    expect(searchVerses(projected.filter(item => item.studyNumber >= 2 && item.studyNumber <= 3), '8:3').map(result => result.verse.book)).toEqual(['John']);
    expect(searchVerses(projected.filter(item => item.studyNumber >= 3 && item.studyNumber <= 3), '8:3')).toEqual([]);
    expect(searchVerses(projected.filter(item => item.studyNumber >= 1 && item.studyNumber <= 1), '8:3')[0].verse.studyNumber).toBe(1);
  });

  it('evaluates semicolon-separated references in order and deduplicates overlaps', () => {
    const verses = [verse('a', 'John', 3, 16, 1), verse('b', 'Acts', 2, 38, 2), verse('c', 'John', 3, 17, 3)];
    const found = searchMultipleReferences(verses, verses, 'John 3:16; Acts 2:38; John 3:16-17');
    expect(found.results.map(result => result.verse.id)).toEqual(['a', 'b', 'c']);
    expect(found.feedback.map(item => item.status)).toEqual(['matched', 'matched', 'matched']);
  });

  it('supports comma lists, mixed separators, and same-chapter shorthand', () => {
    const verses = [verse('a', 'Psalms', 3, 2, 1), verse('b', 'Psalms', 3, 4, 2), verse('c', 'Psalms', 3, 6, 3), verse('d', 'Acts', 2, 38, 4)];
    expect(searchMultipleReferences(verses, verses, 'Ps 3:2,4,6').results.map(result => result.verse.id)).toEqual(['a', 'b', 'c']);
    expect(searchMultipleReferences(verses, verses, 'Ps 3:2,4-6').results.map(result => result.verse.id)).toEqual(['a', 'b', 'c']);
    expect(searchMultipleReferences(verses, verses, 'Ps 3:2; Acts 2:38, Ps 3:2').results.map(result => result.verse.id)).toEqual(['a', 'd']);
    expect(splitReferenceList('"faith, hope"')).toBeNull();
  });

  it('supports simple exact-word AND and OR operators', () => {
    const verses = [verse('both', 'John', 1, 1, 1, 'Faith works together.'), verse('faith', 'John', 1, 2, 2, 'Faith remains.'), verse('hope', 'John', 1, 3, 3, 'Hope remains.'), verse('near', 'John', 1, 4, 4, 'Faithful works.')];
    expect(parseSearch('faith AND works').kind).toBe('word-and');
    expect(searchVerses(verses, 'faith AND works').map(result => result.verse.id)).toEqual(['both']);
    expect(searchVerses(verses, 'FAITH or HOPE').map(result => result.verse.id)).toEqual(['both', 'faith', 'hope']);
    expect(parseSearch('faith AND').kind).toBe('word-operator-incomplete');
    expect(parseSearch('"faith AND works"').kind).toBe('phrase');
    expect(searchVerses(verses, 'faith AND works', { exactWord: true })).toHaveLength(1);
  });

  it('reports incomplete, invalid, missing, and range-only reference segments', () => {
    const verses = [verse('a', 'John', 3, 16, 1), verse('b', 'John', 3, 17, 2)];
    const found = searchMultipleReferences(verses, [verses[0]], 'John 3:16; Psa ; Acts 2:38; John 3:17');
    expect(found.feedback.map(item => item.status)).toEqual(['matched', 'incomplete', 'missing', 'range-only']);
    expect(found.results.map(result => result.verse.id)).toEqual(['a']);
  });

  it('keeps valid list segments while reporting invalid numeric segments', () => {
    const verses = [verse('a', 'Psalms', 3, 2, 1), verse('b', 'Psalms', 3, 5, 2)];
    for (const query of ['Ps 3:2, 0', 'Ps 3:2; 3:0', '0; Ps 3:2', 'Ps 3:2, 3:5-2']) {
      const found = searchMultipleReferences(verses, verses, query);
      expect(found.results.map(result => result.verse.id)).toEqual(['a']);
      expect(found.feedback.some(item => item.status === 'invalid')).toBe(true);
    }
  });
});

