import { describe, expect, it } from 'vitest';
import pack from '../public/packs/season-2027-v1-1.0.0.json';
import { analyzeScriptureDivision, validateAnalysisReport } from './analysis';
import type { ScripturePack } from './types';

describe('2027 Beginner analysis audit', () => {
  it('matches the audited 192-verse Beginner expectations', () => {
    const scripturePack = pack as ScripturePack;
    const result = analyzeScriptureDivision(scripturePack.verses, 'Beginner', scripturePack).report;
    expect(result.summary.versesAnalyzed).toBe(192);
    expect(result.summary.uniqueBeginningsFound).toBe(191);
    expect(result.summary.uniqueEndingsFound).toBe(192);
    expect(result.unresolved.filter(item => item.kind === 'unique-beginning').map(item => item.reference)).toEqual(['Psalms 8:9']);
    expect(new Set(result.annotations.map(item => item.id)).size).toBe(result.annotations.length);
    expect(validateAnalysisReport(result, scripturePack.verses)).toEqual([]);
    for (const annotation of result.annotations) {
      const verse = scripturePack.verses.find(item => item.id === annotation.verseId);
      expect(annotation.value).toBe(verse?.text.slice(annotation.start, annotation.end));
    }
  });
});
