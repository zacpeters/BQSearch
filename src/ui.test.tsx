import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Help, Settings } from './App';
import { demoPack } from './data/demoPack';

describe('BQ Search navigation and help surfaces', () => {
  it('renders an explicit Back to Lookup action in Settings', () => {
    const html = renderToStaticMarkup(<Settings settings={{ seasonId: demoPack.season.id, division: 'Seniors', studyStart: 1, studyEnd: 6, installedPackId: demoPack.id }} packs={[demoPack]} studyMin={1} studyMax={6} studyStart={1} studyEnd={6} onBack={() => undefined} onChange={() => undefined} />);
    expect(html).toContain('Back to Lookup');
    expect(html).toContain('max="6"');
  });

  it('renders concise supported-syntax Help with a close action', () => {
    const html = renderToStaticMarkup(<Help onClose={() => undefined} />);
    expect(html).toContain('Help');
    expect(html).toContain('Supported operators');
    expect(html).toContain('jn3:16');
    expect(html).toContain('8:3');
    expect(html).toContain('Close help');
    expect(html).toContain('does not need an internet connection');
  });
});

