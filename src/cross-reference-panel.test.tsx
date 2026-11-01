// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CrossReferencePanel } from './App';
import type { ScriptureAnnotation } from './analysis';
import type { ScriptureVerse } from './types';

const first: ScriptureVerse = { id: 'v1', book: 'Psalms', chapter: 3, verse: 2, text: 'Faith is here.', studyNumber: 1, studyNumbers: { Beginner: 1 }, divisions: ['Beginner'] };
const second: ScriptureVerse = { id: 'v2', book: 'Psalms', chapter: 3, verse: 3, text: 'Hope and faith remain.', studyNumber: 2, studyNumbers: { Beginner: 2 }, divisions: ['Beginner'] };

const annotation = (verse: ScriptureVerse, id: string, start: number): ScriptureAnnotation => ({
  id,
  type: 'frequency-2',
  verseId: verse.id,
  division: 'Beginner',
  start,
  end: start + 5,
  value: verse.text.slice(start, start + 5),
  normalizedValue: 'faith',
  source: 'division-analysis',
  analysisVersion: '1.1',
  occurrenceReferences: ['Psalms 3:2', 'Psalms 3:3'],
});

describe('CrossReferencePanel', () => {
  it('shows complete ordered verses and highlights the current occurrence', () => {
    const html = renderToStaticMarkup(<CrossReferencePanel
      panelRef={{ current: null }}
      activeWord={{ annotation: annotation(first, 'a1', 0), target: document.createElement('button') }}
      occurrences={[{ annotation: annotation(first, 'a1', 0), verse: first }, { annotation: annotation(second, 'a2', 9), verse: second }]}
      onClose={vi.fn()}
      preferences={{ uniqueBeginning: true, uniqueEnding: true, frequency1: true, frequency2: true, frequency3: true }}
    />);
    expect(html).toContain('2 occurrences · Beginner division');
    expect(html).toContain('Psalms 3:2 · #1');
    expect(html).toContain('Psalms 3:3 · #2');
    expect(html).toContain('Faith is here.');
    expect(html).toContain('Hope and faith remain.');
    expect(html).toContain('current-occurrence');
    expect((html.match(/study-frequency-2/g) ?? []).length).toBe(2);
  });
});
