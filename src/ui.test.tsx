import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExactWordStats, Help, Settings, StudyMarkings, Walkthrough, installFallbackMessage } from './App';
import { defaultStudyMarkingPreferences } from './AnnotatedVerse';
import { demoPack } from './data/demoPack';

describe('BQ Search navigation and help surfaces', () => {
  it('renders an explicit Back to Lookup action in Settings', () => {
    const html = renderToStaticMarkup(<Settings settings={{ seasonId: demoPack.season.id, division: 'Seniors', studyStart: 1, studyEnd: 6, installedPackId: demoPack.id }} packs={[demoPack]} studyMin={1} studyMax={6} studyStart={1} studyEnd={6} contextMode="off" onBack={() => undefined} onReset={() => undefined} onChange={() => undefined} />);
    expect(html).toContain('Back to Lookup');
    expect(html).toContain('max="6"');
  });

  it('renders concise supported-syntax Help with a close action', () => {
    const html = renderToStaticMarkup(<Help onClose={() => undefined} />);
    expect(html).toContain('Help');
    expect(html).toContain('Find words and phrases');
    expect(html).toContain('jn3.16');
    expect(html).toContain('8:3');
    expect(html).toContain('Close help');
    expect(html).toContain('works without a connection');
    expect(html).toContain('Add to Home Screen');
    expect(html).toContain('Color Coding');
  });

  it('renders exact-word division and range statistics separately', () => {
    const html = renderToStaticMarkup(<ExactWordStats frequency={{ word: 'faith', totalOccurrences: 3, distinctVerseCount: 2, references: [{ reference: 'Genesis 1:1', studyNumber: 1 }, { reference: 'John 3:16', studyNumber: 2 }] }} rangeFrequency={{ totalOccurrences: 1, distinctVerseCount: 1, references: [{ reference: 'Genesis 1:1', studyNumber: 1 }] }} onCopy={() => undefined} />);
    expect(html).toContain('3 occurrences in division');
    expect(html).toContain('1 occurrence in selected range');
    expect(html).toContain('2 occurrences outside the selected range');
    expect(html).toContain('John 3:16');
  });

  it('uses the compact frequency labels without changing preference keys', () => {
    const html = renderToStaticMarkup(<StudyMarkings status="available" preferences={defaultStudyMarkingPreferences} onChange={() => undefined} />);
    expect(html).toContain('Color Coding');
    expect(html).toContain('1x Words');
    expect(html).toContain('2x Words');
    expect(html).toContain('3x Words');
    expect(html).toContain('Unique Beginnings');
    expect(html).toContain('Unique Endings');
    expect(html).toContain('1x blue');
    expect(html).toContain('2x green');
    expect(html).toContain('3x red');
    expect(html).toContain('unique beginning /');
    expect(html).toContain('\\ unique ending');
  });

  it('gives platform-appropriate install guidance', () => {
    expect(installFallbackMessage({ platform: 'iPhone', maxTouchPoints: 5, userAgent: 'iPhone' })).toContain('Add to Home Screen');
    expect(installFallbackMessage({ platform: 'Linux x86_64', maxTouchPoints: 0, userAgent: 'Chrome' })).toContain('browser menu');
  });

  it('renders walkthrough navigation and replay entry point', () => {
    const walkthrough = renderToStaticMarkup(<Walkthrough step={0} onStep={() => undefined} onDismiss={() => undefined} />);
    const help = renderToStaticMarkup(<Help onClose={() => undefined} onReplay={() => undefined} />);
    expect(walkthrough).toContain('Start with search');
    expect(walkthrough).toContain('I’ll come back to this');
    expect(walkthrough).toContain('Show me');
    expect(walkthrough).toContain('Next');
    expect(walkthrough).toContain('John 3:16');
    expect(renderToStaticMarkup(<Walkthrough step={1} onStep={() => undefined} onDismiss={() => undefined} />)).toContain('AND must be uppercase');
    expect(renderToStaticMarkup(<Walkthrough step={2} onStep={() => undefined} onDismiss={() => undefined} />)).toContain('Peek at context');
    expect(renderToStaticMarkup(<Walkthrough step={3} onStep={() => undefined} onDismiss={() => undefined} />)).toContain('Read the markings');
    expect(help).toContain('Replay walkthrough');
  });
});

