import { describe, expect, it } from 'vitest';
import { parseCsvImport, parseJsonImport } from './importers';

describe('question-bank imports', () => {
  it('previews synthetic JSON and migration-bridge data without committing', () => {
    const report = parseJsonImport({ data: { userCollections: [{ id: 'c', name: 'Collection', publisher: 'Synthetic' }], userQuestions: [{ id: 'q', collectionId: 'c', rawQuestion: 'Question', rawAnswer: 'Answer', pointValue: 10, references: [{ book: 'Psalms', chapter: 3, startVerse: 1 }] }] } });
    expect(report.errors).toEqual([]); expect(report.collections[0].id).toBe('c'); expect(report.questions[0].references[0].book).toBe('Psalms');
  });
  it('reports duplicate IDs and invalid point values before commit', () => {
    const report = parseJsonImport({ collections: [], questions: [{ id: 'bad', collectionId: 'c', rawQuestion: 'Question', rawAnswer: 'Answer', pointValue: 5 }, { id: 'q', collectionId: 'c', rawQuestion: 'Question 2', rawAnswer: 'Answer 2', pointValue: 10 }, { id: 'q', collectionId: 'c', rawQuestion: 'Question 3', rawAnswer: 'Answer 3', pointValue: 20 }] });
    expect(report.errors.length).toBe(1); expect(report.duplicateIds).toEqual(['q']);
  });
  it('parses the supported CSV fields and reference warning path', () => {
    const report = parseCsvImport('external id,collection,question,answer,point value,scripture references\nq,Local,Question,Answer,20,"Psalm 3:1"');
    expect(report.errors).toEqual([]); expect(report.questions[0].pointValue).toBe(20); expect(report.questions[0].references[0].chapter).toBe(3);
  });
  it('preserves quoted commas, escaped quotes, and multiline fields', () => {
    const csv = 'external id,collection,question,answer,point value,scripture references\nq,Local,"Question, with ""quoted"" words","First line\nsecond line",10,"Psalm 3:1"';
    const report = parseCsvImport(csv);
    expect(report.errors).toEqual([]);
    expect(report.questions[0].rawQuestion).toBe('Question, with "quoted" words');
    expect(report.questions[0].rawAnswer).toBe('First line\nsecond line');
  });

  it('keeps the original V5 CSV fields and accepts the older references header', () => {
    const report = parseCsvImport('external id,collection,question,answer,pointValue,references,year,answer parts\nq,Local,Question,Answer,30,Ps 3:1–2,2027,First|Second');
    expect(report.errors).toEqual([]);
    expect(report.collections[0]).toMatchObject({ year: 2027, bundled: false });
    expect(report.questions[0]).toMatchObject({ id: 'q', pointValue: 30, answerParts: ['First', 'Second'], references: [{ book: 'Psalms', chapter: 3, startVerse: 1, endVerse: 2 }] });
  });
});
