// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { searchVerses, parseSearch } from './search';
import { projectVersesForDivision } from './division';
import type { ScripturePack } from './types';

// Build expectations directly from source text, independently of search/tokenize.
const wordsIn = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+(?:(?:['’]|-)[\p{L}\p{N}]+)*/gu) ?? [];
const packs = import.meta.glob<ScripturePack>('../public/packs/*.json', { eager: true, import: 'default' });
for (const [file, pack] of Object.entries(packs)) {
  describe(`complete vocabulary audit: ${file}`, () => {
    for (const division of new Set(pack.verses.flatMap(verse => verse.divisions))) {
      it(`returns expected verses for every ${division} word`, () => {
        const verses = projectVersesForDivision(pack.verses, division);
        const expected = new Map<string, string[]>();
        for (const verse of verses) for (const word of new Set(wordsIn(verse.text))) {
          expected.set(word, [...(expected.get(word) ?? []), verse.id]);
        }
        const failures: string[] = [];
        for (const [word, ids] of expected) {
          for (const query of [word, word.toUpperCase(), `  ${word}  `]) {
            const exact = searchVerses(verses, query, { exactWord: true }).map(result => result.verse.id);
            if (JSON.stringify(exact) !== JSON.stringify(ids)) failures.push(`${JSON.stringify(query)} exact (${parseSearch(query).kind}): expected ${ids.length}, got ${exact.length}`);
          }
          const normalExpected = verses.filter(verse => `${verse.book} ${verse.text}`.toLowerCase().includes(word)).map(verse => verse.id);
          const normal = searchVerses(verses, word).map(result => result.verse.id);
          if (JSON.stringify(normal) !== JSON.stringify(normalExpected)) failures.push(`${word} ordinary: expected ${normalExpected.length}, got ${normal.length}`);
        }
        console.info(`${pack.id} ${division}: ${verses.length} verses, ${expected.size} words, ${expected.size * 4} checks, ${failures.length} failures`);
        expect(failures).toEqual([]);
      }, 120_000);
    }
  });
}
