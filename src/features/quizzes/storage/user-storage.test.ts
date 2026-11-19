import { expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import type { UserCollection, UserQuestion } from '../types';
import { addAttempt, makeSession } from '../practice/practice';
import { commitUserContent, listQuizSessions, listUserCollections, listUserQuestions, openPracticeSession, savePracticeSession } from './user-storage';

it('rolls back an import if it would overwrite a question or orphan it', async () => {
  const collection: UserCollection = { id: 'existing-collection', name: 'Existing', publisher: 'Synthetic', sourceFilename: 'fixture', quizIds: [], bundled: false };
  const question: UserQuestion = {
    id: 'existing-question', collectionId: collection.id, rawQuestion: 'Stored question', rawAnswer: 'Stored answer',
    pointValue: 10, quizNumber: 0, originalNumber: 1, references: [], textRevision: 'original',
    source: { documentId: 'fixture', page: 0 },
  };
  await commitUserContent([collection], [question]);
  const pending = { ...collection, id: 'pending-collection' };

  await expect(commitUserContent([pending], [{ ...question, collectionId: pending.id, rawAnswer: 'Overwrite' }])).rejects.toThrow();
  await expect(commitUserContent([pending], [{ ...question, id: 'orphan', collectionId: 'missing' }])).rejects.toThrow('is no longer available');

  expect(await listUserCollections()).toEqual([collection]);
  expect(await listUserQuestions()).toEqual([question]);
});

it('resumes a single latest session and rejects a stale write without changing practice history', async () => {
  const quizId = 'practice-storage-test';
  const [original, secondOpen] = await Promise.all([openPracticeSession(quizId), openPracticeSession(quizId)]);
  expect(secondOpen).toEqual(original);
  const scoring = { questionId: 'practice-question', team: 'red', quizzerId: 'R1', result: 'correct', type: 'original', interrupted: false } as const;
  const saved = addAttempt(original, scoring);
  await savePracticeSession(saved, original);
  const stale = addAttempt(secondOpen, { ...scoring, result: 'incorrect' });
  await expect(savePracticeSession(stale, secondOpen)).rejects.toThrow('changed in another tab');
  expect(await openPracticeSession(quizId)).toEqual(saved);

  const reset = { ...makeSession(quizId), updatedAt: new Date(Date.parse(saved.updatedAt) + 1000).toISOString() };
  await savePracticeSession(reset);
  expect(await openPracticeSession(quizId)).toEqual(reset);
  expect(await listQuizSessions()).toEqual(expect.arrayContaining([saved, reset]));
});
