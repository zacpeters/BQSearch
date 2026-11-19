import { expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import type { UserCollection, UserQuestion } from '../types';
import { commitUserContent, listUserCollections, listUserQuestions } from './user-storage';

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
