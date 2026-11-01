import { describe, expect, it } from 'vitest';
import { analyzeScriptureDivision } from '../analysis';
import { projectVersesForDivision } from '../division';
import { parseImportFiles, reviewReferences } from './importer';
import { generatePack } from './pack';
import { buildReleaseZip, createDeterministicZip, suggestedReleaseFilename, validateReleaseBundle } from './release';

const source = { get: (reference: string) => reference === 'Psalms 3:1' ? 'Lord, how are they increased.' : 'Many there be which say.' };

async function fixture() {
  const parsed = parseImportFiles([{ fileName: 'beginner.txt', division: 'Beginner', text: 'Psalms 3:1' }, { fileName: 'junior.txt', division: 'Junior', text: 'Psalms 3:1\nPsalms 3:2' }]);
  const review = reviewReferences(parsed.specs, source);
  return generatePack({ id: 'season-test', title: 'Psalms 2027', version: '1.0.0', seasonId: 'season-test', seasonName: '2027', year: 2027, references: review.references, source: { name: 'test', license: 'test', retrievedAt: 'local-preparation' } });
}

describe('deterministic release bundles', () => {
  it('derives a complete release filename', () => {
    expect(suggestedReleaseFilename({ title: 'Psalms 2027', season: { year: 2027 } }, ['Beginner', 'Junior'])).toBe('Psalms-2027-Complete.zip');
  });

  it('validates every included division against the final pack checksum', async () => {
    const pack = await fixture();
    const reports = { Beginner: analyzeScriptureDivision(projectVersesForDivision(pack.verses, 'Beginner'), 'Beginner', pack).report, Junior: analyzeScriptureDivision(projectVersesForDivision(pack.verses, 'Junior'), 'Junior', pack).report };
    const validation = await validateReleaseBundle(pack, reports, ['beginner.txt', 'junior.txt']);
    expect(validation.valid).toBe(true);
    expect(validation.manifest?.pack.checksum).toBe(pack.integrityChecksum);
    expect(validation.files?.map(file => file.path)).toEqual(['packs/season-test-1.0.0.json', 'analysis/season-test/Beginner.json', 'analysis/season-test/Junior.json', 'manifest.json', 'validation-report.txt']);
    expect(validation.manifest?.sourceFiles).toEqual(['beginner.txt', 'junior.txt']);
    expect(validation.warnings).toEqual([]);
  });

  it('blocks missing or mismatched division reports', async () => {
    const pack = await fixture();
    const beginner = analyzeScriptureDivision(projectVersesForDivision(pack.verses, 'Beginner'), 'Beginner', pack).report;
    const missing = await validateReleaseBundle(pack, { Beginner: beginner });
    expect(missing.valid).toBe(false);
    const mismatched = { ...beginner, division: 'Junior' as const };
    const invalid = await validateReleaseBundle(pack, { Beginner: invalidReport(mismatched) });
    expect(invalid.errors.some(error => error.includes('Beginner analysis is invalid'))).toBe(true);
  });

  it('produces identical ZIP bytes for identical inputs', async () => {
    const files = [{ path: 'b.txt', content: 'B' }, { path: 'a.txt', content: 'A' }];
    expect(Array.from(createDeterministicZip(files))).toEqual(Array.from(createDeterministicZip(files)));
    const pack = await fixture();
    const reports = { Beginner: analyzeScriptureDivision(projectVersesForDivision(pack.verses, 'Beginner'), 'Beginner', pack).report, Junior: analyzeScriptureDivision(projectVersesForDivision(pack.verses, 'Junior'), 'Junior', pack).report };
    const validation = await validateReleaseBundle(pack, reports);
    expect(Array.from(await buildReleaseZip(validation))).toEqual(Array.from(await buildReleaseZip(validation)));
  });

  it('exports a realistically sized complete four-division release without stack overflow', async () => {
    const lines = Array.from({ length: 530 }, (_, index) => `Psalms ${Math.floor(index / 4) + 1}:${index % 4 + 1}`).join('\n');
    const parsed = parseImportFiles((['Beginner', 'Junior', 'Intermediate', 'Experienced'] as const).map(division => ({ fileName: `${division}.txt`, division, text: lines })));
    const review = reviewReferences(parsed.specs, { get: reference => `${reference} ${'Verified KJV text. '.repeat(90)}` });
    const pack = await generatePack({ id: 'season-large', title: 'Psalms 2027 Complete', version: '1.0.0', seasonId: 'season-large', seasonName: '2027', year: 2027, references: review.references, source: { name: 'test', license: 'test', retrievedAt: 'local-preparation' } });
    const reports = Object.fromEntries((['Beginner', 'Junior', 'Intermediate', 'Experienced'] as const).map(division => [division, largeReport(pack, division)]));
    const validation = await validateReleaseBundle(pack, reports, ['Beginner.txt', 'Junior.txt', 'Intermediate.txt', 'Experienced.txt']);
    expect(validation.valid).toBe(true);
    const first = await buildReleaseZip(validation);
    const second = await buildReleaseZip(validation);
    expect(first.length).toBeGreaterThan(500_000);
    expect(Array.from(first)).toEqual(Array.from(second));
  });
});

function invalidReport(report: ReturnType<typeof analyzeScriptureDivision>['report']) { return report; }

function largeReport(pack: Awaited<ReturnType<typeof fixture>>, division: 'Beginner' | 'Junior' | 'Intermediate' | 'Experienced') {
  const unresolved = pack.verses.map(verse => ({ kind: 'unique-beginning' as const, verseId: verse.id, reference: `${verse.book} ${verse.chapter}:${verse.verse}`, reason: 'synthetic review case' }));
  return { analysisVersion: '1.1' as const, sourcePack: { id: pack.id, version: pack.version, checksum: pack.integrityChecksum }, division, configuration: { offsetConvention: 'utf-16-code-units' as const, frequencyScope: 'complete-division' as const, boundaryScope: 'complete-division' as const }, summary: { versesAnalyzed: pack.verses.length, uniqueBeginningsFound: 0, unresolvedBeginnings: unresolved.length, uniqueEndingsFound: 0, unresolvedEndings: 0, frequency1Words: 0, frequency2Words: 0, frequency3Words: 0, annotations: 0 }, beginnings: [], endings: [], annotations: [], unresolved, warnings: [], errors: [] };
}
