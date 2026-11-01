import { describe, expect, it } from 'vitest';
import { ANALYSIS_VERSION, analysisJson, analyzeScriptureDivision, validateAnalysisReport } from './analysis';
import type { ScriptureVerse } from './types';

const verse = (id: string, text: string, studyNumber: number, divisions: ScriptureVerse['divisions'] = ['Beginner'], studyNumbers?: ScriptureVerse['studyNumbers']): ScriptureVerse => ({ id, book: 'Psalms', chapter: 1, verse: studyNumber, text, studyNumber, divisions, studyNumbers });

describe('Phase 3A Scripture analysis', () => {
  it('finds shortest unique beginnings and unresolved prefix cases with UTF-16 offsets', () => {
    const verses = [verse('a', 'The Lord is my shepherd.', 1), verse('b', 'The Lord is my strength.', 2), verse('c', 'Blessed is the man.', 3), verse('d', 'The Lord is good', 4), verse('e', 'The Lord is good to all', 5)];
    const report = analyzeScriptureDivision(verses, 'Beginner').report;
    expect(report.beginnings.find(item => item.verseId === 'a')).toMatchObject({ status: 'unique', phrase: 'The Lord is my shepherd', start: 0, end: 23 });
    expect(report.beginnings.find(item => item.verseId === 'c')).toMatchObject({ status: 'unique', phrase: 'Blessed', tokenCount: 4 });
    expect(report.beginnings.find(item => item.verseId === 'd')).toMatchObject({ status: 'unresolved' });
    expect(report.beginnings.find(item => item.verseId === 'e')).toMatchObject({ status: 'unique', phrase: 'The Lord is good to' });
    expect(verses[0].text).toBe('The Lord is my shepherd.');
  });

  it('finds shortest unique endings, including punctuation-preserving offsets', () => {
    const verses = [verse('a', 'The Lord is good.', 1), verse('b', 'The Lord is great.', 2), verse('c', 'All things work for good.', 3), verse('d', '', 4)];
    const report = analyzeScriptureDivision(verses, 'Beginner').report;
    expect(report.endings.find(item => item.verseId === 'a')).toMatchObject({ status: 'unique', phrase: 'is good' });
    expect(report.endings.find(item => item.verseId === 'b')).toMatchObject({ status: 'unique', phrase: 'great', start: 12, end: 17 });
    expect(report.endings.find(item => item.verseId === 'd')).toMatchObject({ status: 'unresolved', reason: 'empty-text' });
  });

  it('classifies frequencies by total occurrences and keeps repeated positions', () => {
    const verses = [verse('a', 'Faith faith hope.', 1), verse('b', 'Faith hope.', 2), verse('c', 'Hope alone.', 3)];
    const { report, frequencies } = analyzeScriptureDivision(verses, 'Beginner');
    expect(frequencies.get('faith')).toMatchObject({ totalOccurrences: 3, distinctVerseCount: 2 });
    const faithAnnotations = report.annotations.filter(item => item.normalizedValue === 'faith');
    expect(faithAnnotations).toHaveLength(3);
    expect(new Set(faithAnnotations.map(item => item.type))).toEqual(new Set(['frequency-3']));
    expect(report.summary.frequency1Words).toBeGreaterThan(0);
    expect(report.annotations.find(item => item.normalizedValue === 'faith')?.occurrenceReferences).toEqual(['Psalms 1:1', 'Psalms 1:2']);
  });

  it('analyzes divisions independently and remains independent of visible ranges', () => {
    const verses = [verse('a', 'Faith.', 1, ['Beginner', 'Junior'], { Beginner: 1, Junior: 10 }), verse('b', 'Faith.', 2, ['Beginner'], { Beginner: 2 })];
    const beginner = analyzeScriptureDivision(verses, 'Beginner').report;
    const junior = analyzeScriptureDivision(verses, 'Junior').report;
    expect(beginner.summary.versesAnalyzed).toBe(2);
    expect(junior.summary.versesAnalyzed).toBe(1);
    expect(beginner.annotations.every(item => item.division === 'Beginner')).toBe(true);
    expect(junior.annotations.every(item => item.division === 'Junior')).toBe(true);
  });

  it('exports deterministically and validates duplicate or invalid annotations', () => {
    const report = analyzeScriptureDivision([verse('a', 'Unique word.', 1)], 'Beginner').report;
    expect(report.analysisVersion).toBe(ANALYSIS_VERSION);
    expect(analysisJson(report)).toBe(analysisJson(report));
    const invalid = { ...report, annotations: [...report.annotations, { ...report.annotations[0], id: 'duplicate', start: 100, end: 101 }, { ...report.annotations[0], id: 'duplicate' }] };
    expect(validateAnalysisReport(invalid, [verse('a', 'Unique word.', 1)])).toEqual(expect.arrayContaining([expect.stringContaining('Invalid annotation offsets'), expect.stringContaining('Duplicate annotation identifier')]));
  });

  it('separates exact original values from normalized matching values', () => {
    const verses = [verse('a', 'Therefore LORD is with Israel.', 1), verse('b', 'therefore lord is with Zion.', 2)];
    const report = analyzeScriptureDivision(verses, 'Beginner').report;
    for (const annotation of report.annotations) expect(annotation.value).toBe(verses.find(item => item.id === annotation.verseId)?.text.slice(annotation.start, annotation.end));
    for (const annotation of report.annotations.filter(item => item.type.startsWith('frequency-'))) expect(annotation.normalizedValue).toBe(annotation.value.toLocaleLowerCase());
    const lord = report.annotations.filter(item => item.normalizedValue === 'lord');
    expect(lord.map(item => item.value)).toEqual(['LORD', 'lord']);
    expect(lord.every(item => item.start < item.end)).toBe(true);
    expect(verses[0].text).toBe('Therefore LORD is with Israel.');
  });

  it('keeps case-insensitive unique boundaries while preserving punctuation and Unicode offsets', () => {
    const verses = [verse('a', 'Lord—be praised!', 1), verse('b', 'lord—be humble?', 2), verse('c', 'Zion is holy…', 3)];
    const report = analyzeScriptureDivision(verses, 'Beginner').report;
    expect(report.beginnings.find(item => item.verseId === 'a')?.normalizedPhrase).toBe('lord be praised');
    expect(report.beginnings.find(item => item.verseId === 'b')?.normalizedPhrase).toBe('lord be humble');
    for (const annotation of report.annotations) expect(annotation.value).toBe(verses.find(item => item.id === annotation.verseId)?.text.slice(annotation.start, annotation.end));
  });

  it('treats hyphenated lexical units as whole words for frequency analysis', () => {
    const verses = [verse('a', 'He turned us-ward.', 1), verse('b', 'The ward was open.', 2)];
    const { frequencies, report } = analyzeScriptureDivision(verses, 'Beginner');
    expect(frequencies.get('us-ward')?.totalOccurrences).toBe(1);
    expect(frequencies.get('ward')?.totalOccurrences).toBe(1);
    expect(report.annotations.filter(item => item.normalizedValue === 'ward')).toHaveLength(1);
    expect(report.annotations.some(item => item.normalizedValue === 'us-ward')).toBe(true);
  });
});
