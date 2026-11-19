import { describe, expect, it } from 'vitest';
import type { ScripturePack } from '../../types';
import type { GenerationFilters, QuizQuestion } from './types';
import { analyzeQuestionPool, DEFAULT_POINT_COUNTS, eligibleQuestions, generateSelection, poolCounts, studyOptions } from './generator';
import { classificationKey, classificationLabel } from './generator/classifications';
import catalog from './catalog/bqquiz-2027.json';

const pack: ScripturePack = { id: 'synthetic-pack', schemaVersion: '1.0', title: 'Synthetic pack', version: '1', status: 'approved', season: { id: 'synthetic-season', name: 'Synthetic', year: 2030, schemaVersion: '1.0' }, verses: [1, 2, 4].map((verse, index) => ({ id: `psalms-3-${verse}`, book: 'Psalms', chapter: 3, verse, text: `Verse ${verse}`, studyNumber: index + 1, studyNumbers: { Beginner: index + 1 }, divisions: ['Beginner'] })) };
const question = (id: string, pointValue: 10 | 20 | 30, references: QuizQuestion['references'], classification = 'Direct', collectionId = 'collection'): QuizQuestion => ({ id, collectionId, quizNumber: 1, originalNumber: Number(id.replace(/\D/g, '')) || 1, pointValue, classification, rawQuestion: id, rawAnswer: 'answer', references, source: { documentId: 'synthetic', page: 1, publisher: 'Synthetic', collection: 'Synthetic' }, textRevision: 'test' });
const base: GenerationFilters = { collectionIds: ['collection'], publisherIds: ['Synthetic'], pointCounts: { 10: 1, 20: 0, 30: 0 }, classifications: [], restrictCoverage: true, coverage: { start: { book: 'Psalms', chapter: 3, startVerse: 1 }, end: { book: 'Psalms', chapter: 3, startVerse: 2 }, startStudyNumber: 1, endStudyNumber: 2 }, strategy: 'balanced', seasonId: 'synthetic-season', division: 'Beginner', packId: 'synthetic-pack' };

describe('BQ Search quiz generator', () => {
  it('uses actual study order and preserves gaps', () => { expect(studyOptions(pack, 'Beginner').map(option => option.studyNumber)).toEqual([1, 2, 3]); expect(studyOptions(pack, 'Beginner').map(option => option.reference.startVerse)).toEqual([1, 2, 4]); });
  it('requires every reference in a multi-reference question to fit the range', () => { const questions = [question('inside', 10, [{ book: 'Psalms', chapter: 3, startVerse: 1 }]), question('crossing', 10, [{ book: 'Psalms', chapter: 3, startVerse: 1 }, { book: 'Psalms', chapter: 3, startVerse: 4 }]), question('missing-ref', 10, [])]; expect(eligibleQuestions(questions, base, pack).map(item => item.id)).toEqual(['inside']); expect(eligibleQuestions(questions, { ...base, restrictCoverage: false }, pack).map(item => item.id)).toEqual(['inside', 'crossing', 'missing-ref']); });
  it('supports normalized types, publisher/collection filters, exact distribution, and deterministic seeds', () => { const questions = [question('a', 10, [{ book: 'Psalms', chapter: 3, startVerse: 1 }], 'Two-Part', 'collection'), question('b', 20, [{ book: 'Psalms', chapter: 3, startVerse: 1 }], 'Direct', 'collection'), question('c', 30, [{ book: 'Psalms', chapter: 3, startVerse: 1 }], 'Quotation', 'other')]; const filters = { ...base, pointCounts: { 10: 1, 20: 1, 30: 0 }, classifications: ['Two Part'], coverage: undefined }; expect(poolCounts(questions, filters, pack)).toEqual({ 10: 1, 20: 0, 30: 0 }); const unrestricted = { ...filters, classifications: [], collectionIds: ['collection', 'other'], pointCounts: { 10: 1, 20: 1, 30: 1 } }; expect(generateSelection(questions, unrestricted, pack, 42).selected.map(item => item.id)).toEqual(generateSelection(questions, unrestricted, pack, 42).selected.map(item => item.id)); });
  it('keeps the default 8/9/3 distribution explicit', () => { expect(DEFAULT_POINT_COUNTS).toEqual({ 10: 8, 20: 9, 30: 3 }); });

  it('reproduces both original V5 seed sequences in question-pool order', () => {
    const fixture = ([['z10',10,4],['x20',20,4],['a10',10,3],['y10',10,4],['b20',20,3],['c10',10,5],['d10',10,3],['e30',30,5],['f30',30,4]] as const)
      .map(([id, point, chapter]) => question(id, point, [{ book: 'Psalms', chapter, startVerse: 1 }]));
    const filters = { ...base, restrictCoverage: false, pointCounts: { 10: 4, 20: 2, 30: 1 } };
    expect(generateSelection(fixture, filters, pack, 42).selected.map(item => item.id)).toEqual(['z10','c10','a10','y10','b20','x20','f30']);
    expect(generateSelection(fixture, { ...filters, strategy: 'random' }, pack, 42).selected.map(item => item.id)).toEqual(['y10','c10','d10','z10','b20','x20','f30']);
  });

  it('keeps the published aliases canonical without merging related types', () => {
    expect(new Set(catalog.questions.map(q => classificationKey(q.classification ?? undefined))).size).toBe(14);
    expect(classificationLabel('FO UR-PARTCROSSREFERENCEQUES TION')).toBe('Four-Part · Cross-Reference');
    expect(classificationKey('Cross - Reference Four Part')).toBe(classificationKey('Four-Part · Cross-Reference'));
    const rows = ['Quotation', 'Quotation Completion', 'Cross-Reference Quotation', 'QUOTATIONQUES TION', 'Quotation review']
      .map(type => question(type, 10, [], type));
    expect(eligibleQuestions(rows, { ...base, restrictCoverage: false, classifications: ['Quotation'] }, pack).map(q => q.id))
      .toEqual(['Quotation', 'QUOTATIONQUES TION']);
  });

  it('counts restricted exclusions only after source and type filters and handles invalid references', () => {
    const rows = [question('missing', 10, []), question('other', 10, [], 'Direct', 'other'),
      question('invalid', 10, [{ book: 'Invalid', chapter: 1, startVerse: 1 }]),
      question('inside', 10, [{ book: 'Psalms', chapter: 3, startVerse: 1 }])];
    const filters = { ...base, selectionMode: 'explicit' as const, classifications: ['direct'] };
    const result = analyzeQuestionPool(rows, filters, pack);
    expect(result.pool.map(q => q.id)).toEqual(['inside']);
    expect(result.diagnostics).toEqual({ noStructuredReference: 1, unavailableReferences: 1 });
    expect(analyzeQuestionPool(rows, { ...filters, publisherIds: [] }, pack).pool).toEqual([]);
    expect(analyzeQuestionPool(rows, { ...filters, classifications: [] }, pack).pool).toEqual([]);
    expect(analyzeQuestionPool(rows, { ...filters, restrictCoverage: false }, pack).pool).toHaveLength(3);
  });
});
