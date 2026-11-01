import { normalizeWord, tokenizeScripture, type ScriptureToken } from './tokenize';
import type { ScriptureVerse } from './types';

export interface WordOccurrence extends ScriptureToken {
  reference: string;
  studyNumber: number;
}

export interface WordReference {
  reference: string;
  studyNumber: number;
  occurrences: WordOccurrence[];
}

export interface WordFrequency {
  word: string;
  totalOccurrences: number;
  distinctVerseCount: number;
  references: WordReference[];
}

const referenceFor = (verse: ScriptureVerse) => `${verse.book} ${verse.chapter}:${verse.verse}`;
const orderedVerses = (verses: ScriptureVerse[]) => [...verses].sort((a, b) => (a.studyNumber - b.studyNumber) || a.book.localeCompare(b.book) || (a.chapter - b.chapter) || (a.verse - b.verse) || a.id.localeCompare(b.id));

export function analyzeWordFrequencies(verses: ScriptureVerse[]): Map<string, WordFrequency> {
  const frequencies = new Map<string, WordFrequency>();
  for (const verse of orderedVerses(verses)) {
    const reference = referenceFor(verse);
    for (const token of tokenizeScripture(verse.text)) {
      const occurrence: WordOccurrence = { ...token, reference, studyNumber: verse.studyNumber };
      const current = frequencies.get(token.normalized) ?? { word: token.normalized, totalOccurrences: 0, distinctVerseCount: 0, references: [] };
      let verseReference = current.references[current.references.length - 1];
      if (!verseReference || verseReference.reference !== reference || verseReference.studyNumber !== verse.studyNumber) {
        verseReference = { reference, studyNumber: verse.studyNumber, occurrences: [] };
        current.references.push(verseReference);
        current.distinctVerseCount += 1;
      }
      verseReference.occurrences.push(occurrence);
      current.totalOccurrences += 1;
      frequencies.set(token.normalized, current);
    }
  }
  return frequencies;
}

export function getWordFrequency(verses: ScriptureVerse[], word: string): WordFrequency | undefined {
  return analyzeWordFrequencies(verses).get(normalizeWord(word));
}

