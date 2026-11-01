// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { AnnotatedVerse, defaultStudyMarkingPreferences } from './AnnotatedVerse';
import type { ScriptureAnnotation } from './analysis';
import { setWordComparisonState } from './wordComparison';

const annotation = (verseId: string, id: string, value: string): ScriptureAnnotation => ({ id, type: 'frequency-2', verseId, division: 'Beginner', start: 0, end: value.length, value, normalizedValue: value.toLowerCase(), source: 'division-analysis', analysisVersion: '1.1', occurrenceReferences: ['Psalms 3:1', 'Psalms 3:2'] });
const verse = (id: string, number: number, text: string) => ({ id, book: 'Psalms', chapter: 3, verse: number, text, studyNumber: number, divisions: ['Beginner' as const], studyNumbers: { Beginner: number } });

describe('inline word comparison', () => {
  afterEach(() => setWordComparisonState(null));

  it('renders a 2x comparison beneath the selected annotated verse and toggles closed', async () => {
    const first = verse('v1', 1, 'Faith is sure.'); const second = verse('v2', 2, 'faith is strong.');
    const firstAnnotation = annotation(first.id, 'a1', 'Faith'); const secondAnnotation = annotation(second.id, 'a2', 'faith');
    const target = document.createElement('button'); const panelRef = { current: null as HTMLElement | null }; const container = document.createElement('div'); document.body.appendChild(container); const root = createRoot(container);
    setWordComparisonState({ activeWord: { annotation: firstAnnotation, target }, occurrences: [{ annotation: firstAnnotation, verse: first }, { annotation: secondAnnotation, verse: second }], onClose: () => setWordComparisonState(null), panelRef });
    await act(async () => { root.render(createElement(AnnotatedVerse, { verseId: first.id, text: first.text, annotations: [firstAnnotation], preferences: defaultStudyMarkingPreferences, onFrequencyWord: () => undefined })); });
    expect(container.querySelector('.inline-cross-reference')).toBeTruthy();
    expect(container.textContent).toContain('2 occurrences');
    expect(container.textContent).toContain('Psalms 3:2');
    expect(container.querySelector('[data-original-text="Faith is sure."]')).toBeTruthy();
    await act(async () => { setWordComparisonState(null); });
    expect(container.querySelector('.inline-cross-reference')).toBeNull();
    root.unmount(); container.remove();
  });
});
