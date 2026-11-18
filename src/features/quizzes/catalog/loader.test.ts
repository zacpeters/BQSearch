import { describe, expect, it } from 'vitest';
import { validateCatalog } from './loader';

const question = (id: string, originalNumber: number) => ({ id, collectionId: 'local-collection', quizNumber: 1, originalNumber, pointValue: 10 as const, rawQuestion: `Synthetic question ${originalNumber}`, rawAnswer: 'Synthetic answer', classification: 'Direct', references: [{ book: 'Psalms', chapter: 3, startVerse: originalNumber }], source: { documentId: 'synthetic', page: originalNumber, publisher: 'Synthetic', collection: 'Synthetic collection' }, textRevision: 'test-v1' });
const valid = () => ({ schemaVersion: 2, sourceSet: { id: 'synthetic-catalog', title: 'Synthetic local catalog', edition: 'test', status: 'verified' }, collections: [{ id: 'local-collection', publisher: 'Synthetic', name: 'Synthetic collection', sourceFilename: 'local.json', quizIds: ['local-quiz'] }], quizzes: [{ id: 'local-quiz', collectionId: 'local-collection', quizNumber: 1, title: 'Quiz 1', edition: 'test', questionIds: ['question-1', 'question-2'], sections: [{ pointValue: 10, startQuestion: 1, endQuestion: 2 }] }], questions: [question('question-1', 1), question('question-2', 2)] });

describe('local quiz catalog validation', () => {
  it('preserves IDs, ordering, point values, classifications, source, and references', () => {
    const result = validateCatalog(valid());
    expect(result.valid).toBe(true);
    expect(result.catalog?.quizzes[0].questionIds).toEqual(['question-1', 'question-2']);
    expect(result.catalog?.questions[1]).toMatchObject({ id: 'question-2', originalNumber: 2, pointValue: 10, classification: 'Direct', source: { documentId: 'synthetic', page: 2 } });
  });

  it('rejects unsupported versions, duplicates, and missing relationships', () => {
    const value = valid(); value.schemaVersion = 99; value.quizzes[0].questionIds.push('missing'); value.questions.push(question('question-1', 3));
    const result = validateCatalog(value);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('Unsupported catalog schema version');
    expect(result.errors.join(' ')).toContain('duplicate question IDs');
    expect(result.errors.join(' ')).toContain('missing question');
  });

  it('reports invalid references without rewriting the record', () => {
    const value = valid(); value.questions[0].references = [{ book: 'Not a book', chapter: 1, startVerse: 1 }];
    const result = validateCatalog(value);
    expect(result.valid).toBe(true);
    expect(result.warnings[0]).toContain('invalid Scripture reference');
    expect(result.catalog?.questions[0].references[0]).toEqual({ book: 'Not a book', chapter: 1, startVerse: 1 });
  });
});
