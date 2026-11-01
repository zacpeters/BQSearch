import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { getDivisionStudyNumber, getDivisionStudyRange, projectVersesForDivision, resolveStudyRange, validateDivisionStudyNumbers } from './division';
import { searchVerses } from './search';
import { getSettings, saveSettings } from './storage';
import type { Division, ScripturePack, ScriptureVerse } from './types';

const shared: ScriptureVerse = {
  id: 'john-3-16', book: 'John', chapter: 3, verse: 16, text: 'For God so loved the world.',
  studyNumber: 7, studyNumbers: { Beginner: 1, Junior: 4, Intermediate: 7, Experienced: 9 },
  divisions: ['Beginner', 'Junior', 'Intermediate', 'Experienced'],
};

const pack = (verses: ScriptureVerse[]): ScripturePack => ({
  id: 'division-test', schemaVersion: '1.0', title: 'Division test', version: '1.0.0', status: 'approved',
  season: { id: 'test', name: 'Test', year: 2027, schemaVersion: '1.0' }, verses,
});

describe('division-specific study projections', () => {
  it('uses each shared verse number for the active division', () => {
    expect(getDivisionStudyNumber(shared, 'Beginner')).toBe(1);
    expect(getDivisionStudyNumber(shared, 'Junior')).toBe(4);
    expect(getDivisionStudyNumber(shared, 'Intermediate')).toBe(7);
    expect(getDivisionStudyNumber(shared, 'Experienced')).toBe(9);
    expect(projectVersesForDivision([shared], 'Junior')[0].studyNumber).toBe(4);
  });

  it('uses projected numbers for study searches and range filtering', () => {
    const verses = [
      shared,
      { ...shared, id: 'psalms-3-1', book: 'Psalms', chapter: 3, verse: 1, studyNumber: 8, studyNumbers: { Beginner: 2, Junior: 5, Intermediate: 8, Experienced: 10 }, text: 'LORD, how are they increased that trouble me!' },
    ];
    const junior = projectVersesForDivision(verses, 'Junior');
    expect(junior.map(verse => verse.studyNumber)).toEqual([4, 5]);
    expect(getDivisionStudyRange(verses, 'Junior')).toEqual({ min: 4, max: 5 });
    expect(resolveStudyRange(junior, 1, 999)).toEqual({ start: 4, end: 5, all: true });
    expect(resolveStudyRange(junior, 999, 1000)).toEqual({ start: 5, end: 5, all: false });
    expect(searchVerses(junior, '4')[0].verse.id).toBe('john-3-16');
    expect(junior.filter(verse => verse.studyNumber >= 5 && verse.studyNumber <= 5).map(verse => verse.id)).toEqual(['psalms-3-1']);
  });

  it('recomputes bounds when switching packs and safely clamps invalid ranges', () => {
    const firstPackVerses = [shared];
    const secondPackVerses = [{ ...shared, studyNumber: 22, studyNumbers: { Beginner: 22, Junior: 24, Intermediate: 26, Experienced: 28 } }];
    expect(getDivisionStudyRange(firstPackVerses, 'Beginner')).toEqual({ min: 1, max: 1 });
    expect(getDivisionStudyRange(secondPackVerses, 'Beginner')).toEqual({ min: 22, max: 22 });
    expect(resolveStudyRange(secondPackVerses, -10, 0)).toEqual({ start: 22, end: 22, all: true });
    expect(resolveStudyRange([], 4, 2)).toEqual({ start: 0, end: 0, all: true });
  });

  it('reports missing mappings instead of inheriting another division number', () => {
    const incomplete = { ...shared, studyNumbers: { Beginner: 1 }, divisions: ['Beginner', 'Junior'] as Division[] };
    expect(getDivisionStudyNumber(incomplete, 'Junior')).toBeNull();
    expect(projectVersesForDivision([incomplete], 'Junior')).toEqual([]);
    expect(validateDivisionStudyNumbers(pack([incomplete]))).toEqual(['John 3:16 is missing a valid study number for Junior.']);
    expect(validateDivisionStudyNumbers(pack([{ ...shared, studyNumbers: { Beginner: 1, Junior: 4, Intermediate: 7, Experienced: 9, Seniors: 12 } }]))).toEqual(['John 3:16 has an unsupported study number mapping for Seniors.']);
  });

  it('keeps legacy packs without a mapping object compatible', () => {
    const legacy = { ...shared, studyNumbers: undefined };
    expect(projectVersesForDivision([legacy], 'Junior')[0].studyNumber).toBe(7);
    expect(validateDivisionStudyNumbers(pack([legacy]))).toEqual([]);
  });

  it('persists and reloads the selected division settings', async () => {
    await new Promise<void>((resolve, reject) => { const request = indexedDB.deleteDatabase('scripture-lookup'); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
    await saveSettings({ seasonId: 'test', division: 'Junior', studyStart: 4, studyEnd: 5, installedPackId: 'division-test' });
    expect(await getSettings()).toMatchObject({ division: 'Junior', studyStart: 4, studyEnd: 5 });
  });
});

