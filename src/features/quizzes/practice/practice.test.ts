import { expect, it } from 'vitest';
import { addAttempt, makeSession, questionTextSegments, removeAttempt, updateAttempt } from './practice';

it('recomputes the original and reread state after an attempt correction or removal', () => {
  const session = makeSession('quiz');
  const original = addAttempt(session, { questionId: 'q1', type: 'original', team: 'red', quizzerId: 'R2', result: 'incorrect', interrupted: true });
  expect(original.states.q1).toBe('awaiting-reread');
  const reread = addAttempt(original, { questionId: 'q1', type: 'reread', team: 'yellow', result: 'nr', interrupted: false });
  expect(reread.states.q1).toBe('completed');
  const removed = removeAttempt(reread, reread.attempts[1]);
  expect(removed.states.q1).toBe('awaiting-reread');
  const corrected = updateAttempt(removed, removed.attempts[0], 'correct');
  expect(corrected.states.q1).toBe('completed');
  expect(corrected.attempts[0].id).toBe(original.attempts[0].id);
  expect(removeAttempt(corrected, corrected.attempts[0]).states).toEqual({});
});

it('preserves V5 word indexes and offsets without changing question text', () => {
  const question = 'First,  second\nthird!';
  const segments = questionTextSegments(question);
  expect(segments.map(segment => segment.text).join('')).toBe(question);
  expect(segments.filter(segment => segment.kind === 'word').map(({ wordIndex, charOffset }) => [wordIndex, charOffset])).toEqual([[0, 0], [1, 8], [2, 15]]);
});
