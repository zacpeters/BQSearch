import { describe, expect, it } from 'vitest';
import { parseImportText, parseReference, expandReference, reviewReferences } from './importer';
import { fetchKJVCorpus, parseKJVText } from './kjv';
import { generatePack, validateImportedReferences, verifyPackIntegrity } from './pack';

const corpus = parseKJVText('John 3:16 | For God so loved the world.\nJohn 3:17 | For God sent not his Son.\nRomans 8:28 | And we know that all things work together for good.');

describe('material import and validation', () => {
  it('normalizes aliases and expands ranges without changing order', () => {
    const parsed = parseImportText('Seniors: 7 Jn 3:16-17', 'txt');
    expect(parsed.issues).toHaveLength(0); expect(parsed.specs[0].book).toBe('John'); expect(expandReference(parsed.specs[0])).toEqual(['John 3:16', 'John 3:17']);
  });
  it('preserves division-specific study numbers from JSON', () => {
    const parsed = parseImportText(JSON.stringify([{ reference: 'John 3:16', division: 'Juniors', studyNumber: 2 }, { reference: 'John 3:16', division: 'Seniors', studyNumber: 9 }]), 'json');
    const review = reviewReferences(parsed.specs, corpus); expect(review.issues).toHaveLength(0); expect(review.references.map(row => row.studyNumbers[row.divisions[0]])).toEqual([2, 9]);
  });
  it('assigns the 2027 Beginner sequence in original order', () => {
    const lines = ['Psalms 3:1', ...Array.from({ length: 190 }, (_, index) => `Psalms 3:${index + 2}`), 'Psalms 37:40']; const parsed = parseImportText(lines.join('\n'), 'txt', { defaultDivision: 'Beginner' }); const review = reviewReferences(parsed.specs, { get: reference => `Text for ${reference}` }); expect(review.issues).toHaveLength(0); expect(review.references).toHaveLength(192); expect(review.references[0].canonicalReference).toBe('Psalms 3:1'); expect(review.references[0].divisions[0]).toBe('Beginner'); expect(review.references[0].studyNumbers.Beginner).toBe(1); expect(review.references[191].canonicalReference).toBe('Psalms 37:40'); expect(review.references[191].studyNumbers.Beginner).toBe(192); expect(review.references.map(row => row.studyNumbers.Beginner)).toEqual(Array.from({ length: 192 }, (_, index) => index + 1));
  });
  it('numbers ranges consecutively and independently per division', () => {
    const beginner = parseImportText('Psalms 3:1-3', 'txt', { defaultDivision: 'Beginner' }); const experienced = parseImportText('Psalms 3:1-3', 'txt', { defaultDivision: 'Experienced' }); const rangeCorpus = { get: (reference: string) => `Text for ${reference}` }; const beginnerReview = reviewReferences(beginner.specs, rangeCorpus); const experiencedReview = reviewReferences(experienced.specs, rangeCorpus); expect(beginnerReview.references.map(row => row.studyNumbers.Beginner)).toEqual([1, 2, 3]); expect(experiencedReview.references.map(row => row.studyNumbers.Experienced)).toEqual([1, 2, 3]);
  });
  it('reports duplicates and missing corpus verses', () => {
    const first = parseReference('John 3:16', 1, ['Seniors'], { Seniors: 1 }).spec!; const second = parseReference('John 3:16', 2, ['Seniors'], { Seniors: 1 }).spec!; const review = reviewReferences([first, second], corpus); expect(review.issues.some(issue => issue.kind === 'duplicate-reference')).toBe(true); const missing = reviewReferences([parseReference('John 3:18', 3, ['Seniors'], { Seniors: 2 }).spec!], corpus); expect(missing.issues.some(issue => issue.kind === 'missing-verse')).toBe(true);
  });
  it('surfaces KJV retrieval failures instead of substituting text', async () => {
    await expect(fetchKJVCorpus('https://example.invalid/kjv.txt', async () => new Response('', { status: 503 }))).rejects.toThrow('HTTP 503');
  });
  it('blocks invalid pack generation and creates a checksummed compatible pack', async () => {
    const parsed = parseImportText('John 3:16', 'txt'); const review = reviewReferences(parsed.specs.map(spec => ({ ...spec, studyNumbers: { Seniors: 1 } })), corpus); expect(validateImportedReferences(review.references, review.issues).valid).toBe(true); const pack = await generatePack({ id: 'season-test-v1', title: 'Test Season', version: '1.0.0', seasonId: 'test', seasonName: 'Test', year: 2026, references: review.references, source: { name: 'test corpus', license: 'test', retrievedAt: new Date().toISOString() } }); expect(pack.verses[0].book).toBe('John'); expect(pack.integrityChecksum).toMatch(/^[a-f0-9]{64}$/); expect(await verifyPackIntegrity(pack)).toBe(true);
  });
});
