import { describe, expect, it } from 'vitest';
import { getAdjacentVerse, resolveSurroundingContext, toggleComparison } from './relationships';
import type { ScriptureVerse } from './types';

const v = (id: string, book: string, chapter: number, verse: number, studyNumber: number, text = id): ScriptureVerse => ({ id, book, chapter, verse, studyNumber, divisions: ['Beginner'], text });

describe('verse relationships and comparison selection', () => {
  const verses = [v('first', 'Genesis', 1, 1, 10), v('second', 'Genesis', 1, 2, 30), v('chapter-two', 'Genesis', 2, 1, 50), v('john', 'John', 1, 1, 70)];

  it('uses exact biblical adjacency rather than study-number adjacency', () => {
    expect(getAdjacentVerse(verses, verses[0], 'next')?.id).toBe('second');
    expect(getAdjacentVerse(verses, verses[1], 'next')).toBeUndefined();
    expect(getAdjacentVerse(verses, verses[2], 'previous')).toBeUndefined();
  });

  it('does not jump across missing verses or books without an installed neighbor', () => {
    expect(getAdjacentVerse([verses[0]], verses[0], 'next')).toBeUndefined();
    expect(getAdjacentVerse(verses, verses[3], 'previous')).toBeUndefined();
  });

  it('resolves up to two context verses and stops at a missing immediate neighbor', () => {
    const context = resolveSurroundingContext([verses[0], verses[1], verses[2]], verses[1]);
    expect(context.previous.map(item => item.id)).toEqual(['first']);
    expect(context.next).toHaveLength(0);
    expect(context.nextUnavailable).toBe(true);
  });

  it('supports comparison add, remove, and a four-verse limit', () => {
    expect(toggleComparison([], 'a')).toEqual(['a']);
    expect(toggleComparison(['a', 'b'], 'a')).toEqual(['b']);
    expect(toggleComparison(['a', 'b', 'c', 'd'], 'e')).toEqual(['a', 'b', 'c', 'd']);
  });
});

