import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnnotatedVerse, defaultStudyMarkingPreferences } from './AnnotatedVerse';
import { analyzeScriptureDivision } from './analysis';
import type { ScriptureVerse } from './types';

const verse: ScriptureVerse = { id: 'v1', book: 'Psalms', chapter: 1, verse: 1, text: 'Therefore LORD is good.', studyNumber: 1, studyNumbers: { Beginner: 1 }, divisions: ['Beginner'] };

describe('AnnotatedVerse', () => {
  it('preserves original text and renders boundary markers separately', () => {
    const report = analyzeScriptureDivision([verse], 'Beginner').report;
    const html = renderToStaticMarkup(<AnnotatedVerse text={verse.text} annotations={report.annotations} preferences={defaultStudyMarkingPreferences}/>);
    expect(html).toContain('data-original-text="Therefore LORD is good."');
    expect(html).toContain('beginning-marker');
    expect(html).toContain('ending-marker');
    expect(html).toContain('Therefore');
    expect(html).toContain('LORD');
  });

  it('composes frequency and search classes without changing capitalization', () => {
    const report = analyzeScriptureDivision([verse, { ...verse, id: 'v2', verse: 2, text: 'therefore Zion.' }], 'Beginner').report;
    const html = renderToStaticMarkup(<AnnotatedVerse verseId={verse.id} text={verse.text} annotations={report.annotations} searchRanges={[{ start: 0, end: 9 }]} />);
    expect(html).toContain('study-frequency-2');
    expect(html).toContain('search-match');
    expect(html).toContain('LORD');
  });

  it('filters context annotations by verse identity and emits one marker per boundary', () => {
    const other = { ...verse, id: 'v2', verse: 2, text: 'Another verse.' };
    const report = analyzeScriptureDivision([verse, other], 'Beginner').report;
    const html = renderToStaticMarkup(<AnnotatedVerse verseId={verse.id} text={verse.text} annotations={report.annotations}/>);
    expect((html.match(/beginning-marker/g) ?? []).length).toBe(1);
    expect((html.match(/ending-marker/g) ?? []).length).toBe(1);
    expect(html).not.toContain('Another');
  });

  it('does not render disabled categories or unresolved boundary markers', () => {
    const unresolved = [{ ...verse, id: 'v1', text: 'The Lord is good.' }, { ...verse, id: 'v2', text: 'The Lord is good to all.' }];
    const report = analyzeScriptureDivision(unresolved, 'Beginner').report;
    const html = renderToStaticMarkup(<AnnotatedVerse text={unresolved[0].text} annotations={report.annotations.filter(item => item.verseId === 'v1')} preferences={{ ...defaultStudyMarkingPreferences, frequency1: false, frequency2: false, frequency3: false }}/>);
    expect(html).not.toContain('frequency-');
    expect(html).not.toContain('beginning-marker');
  });

  it('exposes 2x and 3x words as separate accessible controls', () => {
    const first = { ...verse, text: 'Faith end.' };
    const second = { ...verse, id: 'v2', verse: 2, text: 'faith end.' };
    const report = analyzeScriptureDivision([first, second], 'Beginner').report;
    const html = renderToStaticMarkup(<AnnotatedVerse verseId={first.id} text={first.text} annotations={report.annotations} onFrequencyWord={() => undefined} />);
    expect(html).toContain('class="frequency-word study-frequency-2"');
    expect(html).toContain('aria-label="Show other occurrences of Faith"');
    expect(html).toContain('Faith');
  });
});
