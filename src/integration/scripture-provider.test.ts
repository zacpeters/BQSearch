import { describe, expect, it } from 'vitest';
import bundledPack from '../../public/packs/season-2027-v1-1.0.0.json';
import type { ScripturePack } from '../types';
import { projectVersesForDivision } from '../division';
import { searchVerses } from '../search';
import { createPackScriptureProvider, normalizeScriptureReference } from './scripture-provider';

const pack = bundledPack as ScripturePack;

describe('BQ Search-backed ScriptureProvider', () => {
  it('resolves a verified single verse and preserves pack identity', async () => {
    const provider = createPackScriptureProvider(pack, { division: 'Beginner' });
    const result = await provider.getVerse({ book: 'Ps', chapter: 3, startVerse: 1 });
    expect(result.available).toBe(true);
    expect(result.text).toBe(pack.verses.find(verse => verse.id === 'psalms-3-1')?.text);
    expect(result.reference.book).toBe('Psalms');
    expect(result.verses[0].studyNumber).toBe(1);
    expect(result.pack).toMatchObject({ id: pack.id, version: pack.version, seasonId: pack.season.id });
  });

  it('resolves multi-verse citations in canonical and pack study order', async () => {
    const provider = createPackScriptureProvider(pack, { division: 'Beginner' });
    const result = await provider.getVerse({ book: 'Psalms', chapter: 3, startVerse: 1, endVerse: 3 });
    expect(result.available).toBe(true);
    expect(result.verses.map(item => item.verse.verse)).toEqual([1, 2, 3]);
    expect(result.verses.map(item => item.studyNumber)).toEqual([1, 2, 3]);
    expect(result.text).toContain(result.verses[0].verse.text);
    expect((await provider.getVerses([{ book: 'Psalms', chapter: 3, startVerse: 1 }, { book: 'Psalms', chapter: 3, startVerse: 2 }])).map(item => item.available)).toEqual([true, true]);
  });

  it('looks up by actual division study number without deriving order from references', async () => {
    const provider = createPackScriptureProvider(pack, { division: 'Junior' });
    const result = provider.getByStudyNumber(5);
    expect(result?.available).toBe(true);
    expect(result?.verses[0].verse.id).toBe('psalms-5-1');
    expect((await provider.getVerse({ book: 'Psalms', chapter: 5, startVerse: 1 })).verses[0].studyNumber).toBe(5);
  });

  it('reports missing, invalid, division, and range failures explicitly', async () => {
    const provider = createPackScriptureProvider(pack, { division: 'Junior', studyStart: 1, studyEnd: 4 });
    expect((await provider.getVerse({ book: 'Psalms', chapter: 999, startVerse: 1 })).reason).toBe('invalid-reference');
    expect((await provider.getVerse({ book: 'Psalms', chapter: 3, startVerse: 999 })).reason).toBe('missing-verse');
    expect((await provider.getVerse({ book: 'Psalms', chapter: 3, startVerse: 5 })).reason).toBe('outside-division');
    expect((await provider.getVerse({ book: 'Psalms', chapter: 5, startVerse: 1 })).reason).toBe('outside-study-range');
  });

  it('does not fabricate text when a pack version changes or a verse is absent', async () => {
    const changed = { ...pack, version: '1.0.1' };
    const provider = createPackScriptureProvider(changed, { division: 'Beginner' });
    const result = await provider.getVerse({ book: 'Psalms', chapter: 3, startVerse: 999 });
    expect(result.available).toBe(false);
    expect(result.text).toBeUndefined();
    expect(result.pack.version).toBe('1.0.1');
  });

  it('does not mutate the approved pack or change the existing search projection', async () => {
    const projected = projectVersesForDivision(pack.verses, 'Beginner');
    const before = projected.map(verse => `${verse.id}:${verse.studyNumber}`);
    const provider = createPackScriptureProvider(pack, { division: 'Beginner' });
    await provider.getVerse({ book: 'Psalms', chapter: 3, startVerse: 1 });
    expect(projected.map(verse => `${verse.id}:${verse.studyNumber}`)).toEqual(before);
    expect(searchVerses(projected, '#1')[0].verse.id).toBe('psalms-3-1');
  });

  it('normalizes aliases and rejects reversed ranges', () => {
    expect(normalizeScriptureReference({ book: 'psa.', chapter: 3, startVerse: 1 })).toMatchObject({ book: 'Psalms' });
    expect(() => normalizeScriptureReference({ book: 'Psalms', chapter: 3, startVerse: 3, endVerse: 1 })).toThrow('Invalid Scripture verse range');
  });
});
