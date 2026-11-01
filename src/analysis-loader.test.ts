import { describe, expect, it, vi } from 'vitest';
import { analysisAssetUrl, loadAnalysisSidecar, validateAnalysisSidecar } from './analysis-loader';
import { analyzeScriptureDivision } from './analysis';
import type { ScripturePack } from './types';

const pack: ScripturePack = { id: 'pack-1', schemaVersion: '1.0', title: 'Fixture', version: '1.0.0', status: 'approved', season: { id: 'season', name: 'Season', year: 2027, schemaVersion: '1.0' }, verses: [{ id: 'v1', book: 'Psalms', chapter: 1, verse: 1, text: 'LORD is good.', studyNumber: 1, studyNumbers: { Beginner: 1 }, divisions: ['Beginner'] }] };

describe('analysis sidecar loading', () => {
  it('builds base-aware sidecar URLs', () => {
    expect(analysisAssetUrl(pack.id, 'Beginner', '/BQSearch/')).toBe('/BQSearch/analysis/pack-1/Beginner.json');
  });

  it('accepts matching version 1.1 reports and rejects mismatches', () => {
    const report = analyzeScriptureDivision(pack.verses, 'Beginner', pack).report;
    expect(validateAnalysisSidecar(report, pack, 'Beginner')).toMatchObject({ valid: true });
    expect(validateAnalysisSidecar({ ...report, division: 'Junior' }, pack, 'Beginner').valid).toBe(false);
    expect(validateAnalysisSidecar({ ...report, analysisVersion: '1.0' }, pack, 'Beginner').valid).toBe(false);
    expect(validateAnalysisSidecar({ ...report, sourcePack: { ...report.sourcePack, id: 'other' } }, pack, 'Beginner').valid).toBe(false);
  });

  it('reports missing, malformed, and invalid sidecars without throwing', async () => {
    const missing = vi.fn(async () => new Response('', { status: 404 }));
    expect((await loadAnalysisSidecar(pack, 'Beginner', missing, '/BQSearch/')).status).toBe('not-installed');
    const malformed = vi.fn(async () => new Response('{', { status: 200 }));
    expect((await loadAnalysisSidecar(pack, 'Beginner', malformed, '/BQSearch/')).status).toBe('unable-to-load');
    const report = analyzeScriptureDivision(pack.verses, 'Beginner', pack).report;
    const incompatible = vi.fn(async () => new Response(JSON.stringify({ ...report, sourcePack: { ...report.sourcePack, version: '2.0.0' } }), { status: 200 }));
    expect((await loadAnalysisSidecar(pack, 'Beginner', incompatible, '/BQSearch/')).status).toBe('incompatible');
    expect(missing).toHaveBeenCalledWith('/BQSearch/analysis/pack-1/Beginner.json', { cache: 'no-cache' });
  });
});
