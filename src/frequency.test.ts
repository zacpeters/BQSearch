import { describe, expect, it } from 'vitest';
import { analyzeWordFrequencies, getWordFrequency } from './frequency';
import { projectVersesForDivision } from './division';
import type { ScriptureVerse } from './types';

const v = (id: string, book: string, verse: number, studyNumber: number, text: string, studyNumbers?: ScriptureVerse['studyNumbers']): ScriptureVerse => ({ id, book, chapter: 1, verse, studyNumber, studyNumbers, divisions: ['Beginner', 'Junior'], text });

describe('division-wide word frequency analysis', () => {
  const verses = [v('a', 'Genesis', 1, 2, 'Faith faith.'), v('b', 'Genesis', 2, 4, 'Faith and faith.'), v('c', 'John', 1, 1, 'Faithful.')];

  it('separates total occurrences from distinct verses and stores positions', () => {
    const faith = getWordFrequency(verses, 'FAITH');
    expect(faith).toMatchObject({ word: 'faith', totalOccurrences: 4, distinctVerseCount: 2 });
    expect(faith?.references.map(reference => reference.reference)).toEqual(['Genesis 1:1', 'Genesis 1:2']);
    expect(faith?.references.flatMap(reference => reference.occurrences)).toHaveLength(4);
    expect(faith?.references[0].occurrences.map(occurrence => occurrence.start)).toEqual([0, 6]);
  });

  it('does not stem words and supports future 1x/2x/3x/4+ thresholds', () => {
    const index = analyzeWordFrequencies([v('one', 'Genesis', 1, 1, 'alpha'), v('two', 'Genesis', 2, 2, 'beta beta'), v('three', 'Genesis', 3, 3, 'gamma gamma gamma'), v('four', 'Genesis', 4, 4, 'delta delta delta delta'), v('near', 'Genesis', 5, 5, 'faithful')]);
    expect(index.get('alpha')?.totalOccurrences).toBe(1);
    expect(index.get('beta')?.totalOccurrences).toBe(2);
    expect(index.get('gamma')?.totalOccurrences).toBe(3);
    expect(index.get('delta')?.totalOccurrences).toBe(4);
    expect(index.get('faith')).toBeUndefined();
  });

  it('uses division-specific projected study numbers and deterministic ordering', () => {
    const shared = [v('late', 'John', 1, 99, 'Faith', { Beginner: 9, Junior: 2 }), v('early', 'Genesis', 1, 1, 'faith', { Beginner: 1, Junior: 8 })];
    const junior = projectVersesForDivision(shared, 'Junior');
    const faith = getWordFrequency(junior, 'faith');
    expect(faith?.references.map(reference => [reference.reference, reference.studyNumber])).toEqual([['John 1:1', 2], ['Genesis 1:1', 8]]);
  });

  it('is independent of a selected study range', () => {
    const full = getWordFrequency(verses, 'faith');
    const range = getWordFrequency(verses.filter(verse => verse.studyNumber <= 2), 'faith');
    expect(full?.totalOccurrences).toBe(4);
    expect(range?.totalOccurrences).toBe(2);
    expect(full?.distinctVerseCount).toBe(2);
  });
});

