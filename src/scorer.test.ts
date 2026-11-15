import { describe, expect, it } from 'vitest';
import { addScoreEvent, createLiveSession, resetQuestion, setCurrentQuestion, summarizeSession } from './scorer';

describe('live scoring engine', () => {
  it.each(['red', 'yellow'] as const)('keeps the %s interruption penalty when the other team answers', side => {
    const other = side === 'red' ? 'yellow' : 'red';
    for (const question of [1, 7, 13]) {
      let session = createLiveSession('Junior');
      session = addScoreEvent(session, { question, side, kind: 'error', quizzer: 0, interrupted: true });
      session = addScoreEvent(session, { question, side: other, kind: 'correct', quizzer: 1 });
      const value = question === 1 ? 10 : question === 7 ? 20 : 30;
      const summary = summarizeSession(session);
      expect(summary[side].score).toBe(10 - value / 2);
      expect(summary[side].quizzers[0].errors).toBe(1);
      expect(summary[side].quizzers[0].score).toBe(-value / 2);
      expect(summary[other].score).toBe(10 + value);
      // Editing the second ruling must retain the penalty exactly once.
      session = addScoreEvent(session, { question, side: other, kind: 'error', quizzer: 1 });
      expect(session.events).toHaveLength(2);
      expect(summarizeSession(session)[side].score).toBe(10 - value / 2);
      expect(summarizeSession(session)[other].score).toBe(10 - value / 2);
    }
  });

  it('keeps an interruption penalty after no response and clears it when reset', () => {
    let session = createLiveSession('Junior');
    session = addScoreEvent(session, { question: 1, side: 'red', kind: 'error', quizzer: 0, interrupted: true });
    session = addScoreEvent(session, { question: 1, side: 'question', kind: 'no-response' });
    expect(summarizeSession(session).red.score).toBe(5);
    expect(summarizeSession(resetQuestion(session)).red.score).toBe(10);
  });

  it('waits for the second response after an interruption on the final question', () => {
    let session = createLiveSession('Junior');
    session = addScoreEvent(session, { question: 15, side: 'red', kind: 'error', quizzer: 0, interrupted: true });
    expect(session.quizEnded).toBe(false);
    session = addScoreEvent(session, { question: 15, side: 'yellow', kind: 'correct', quizzer: 0 });
    expect(session.quizEnded).toBe(true);
    expect(summarizeSession(session).red.score).toBe(-5);
    expect(summarizeSession(session).yellow.score).toBe(40);
  });

  it('applies team bonus, question value, and quizzer bonus', () => {
    let session = createLiveSession('Junior');
    for (let question = 1; question <= 6; question++) session = addScoreEvent(session, { question, side: 'red', kind: 'correct', quizzer: 0 });
    const summary = summarizeSession(session);
    expect(summary.red.score).toBe(10 + 6 * 10 + 10);
    expect(summary.red.quizzers[0].eligible).toBe(false);
    expect(summary.red.quizzers[0].quizOut).toBe(true);
  });

  it('applies half-value errors and fouls', () => {
    let session = createLiveSession('Junior');
    session = addScoreEvent(session, { question: 1, side: 'yellow', kind: 'error', quizzer: 1 });
    session = addScoreEvent(session, { question: 1, side: 'yellow', kind: 'foul', quizzer: 1 });
    session = addScoreEvent(session, { question: 1, side: 'yellow', kind: 'team-foul' });
    const summary = summarizeSession(session);
    expect(summary.yellow.score).toBe(10 - 5 - 5 - 5);
  });

  it('keeps no-response and contest events auditable without changing score', () => {
    let session = createLiveSession('Junior');
    session = addScoreEvent(session, { question: 1, side: 'question', kind: 'no-response' });
    session = addScoreEvent(session, { question: 1, side: 'red', kind: 'contest', contest: 'granted' });
    expect(summarizeSession(session).red.score).toBe(10);
    expect(session.events).toHaveLength(2);
    expect(session.events[0].side).toBe('question');
  });

  it('supports continuation questions and navigation', () => {
    const session = setCurrentQuestion(createLiveSession('Junior'), 16);
    expect(summarizeSession(session).questionValues[15]).toBe(20);
  });

  it('uses the senior overtime phases and closes when the tie is broken', () => {
    const session = { ...createLiveSession('Experienced'), currentQuestion: 29, overtimeStarted: true };
    const summary = summarizeSession(session);
    expect(summary.questionValues.slice(20, 28)).toEqual([20, 20, 20, 20, 20, 20, 20, 20]);
    expect(summary.questionValues.slice(28, 30)).toEqual([10, 10]);
  });

  it('resets only the active question events', () => {
    let session = createLiveSession('Junior');
    session = addScoreEvent(session, { question: 1, side: 'red', kind: 'correct', quizzer: 0 });
    session = setCurrentQuestion(session, 2);
    session = addScoreEvent(session, { question: 2, side: 'yellow', kind: 'foul', quizzer: 1 });
    expect(resetQuestion(session).events.map(event => event.question)).toEqual([1]);
  });

  it('replaces a mistaken response when a question is edited', () => {
    let session = createLiveSession('Junior');
    session = addScoreEvent(session, { question: 1, side: 'red', kind: 'correct', quizzer: 0 });
    session = addScoreEvent(session, { question: 1, side: 'yellow', kind: 'correct', quizzer: 1 });
    const summary = summarizeSession(session);
    expect(session.events.filter(event => event.question === 1 && ['correct', 'error', 'no-response'].includes(event.kind))).toHaveLength(1);
    expect(summary.red.score).toBe(10);
    expect(summary.yellow.score).toBe(20);
  });

  it('does not count a granted contest as another response', () => {
    let session = createLiveSession('Junior');
    session = addScoreEvent(session, { question: 1, side: 'red', kind: 'correct', quizzer: 0 });
    session = addScoreEvent(session, { question: 1, side: 'red', kind: 'contest', contest: 'granted' });
    expect(summarizeSession(session).red.score).toBe(20);
    expect(session.events).toHaveLength(2);
  });

  it('tracks rule-based timeout and contest allowances', () => {
    let session = createLiveSession('Junior');
    session = addScoreEvent(session, { question: 1, side: 'red', kind: 'timeout', timeout: 'standard' });
    session = addScoreEvent(session, { question: 1, side: 'red', kind: 'timeout', timeout: 'substitution' });
    session = addScoreEvent(session, { question: 1, side: 'red', kind: 'contest', contest: 'withdrawn' });
    session = addScoreEvent(session, { question: 2, side: 'red', kind: 'contest', contest: 'denied' });
    const team = summarizeSession(session).red;
    expect(team.standardTimeoutsRemaining).toBe(1);
    expect(team.substitutionTimeoutsRemaining).toBe(0);
    expect(team.withdrawnContestsRemaining).toBe(3);
    expect(team.deniedContestsRemaining).toBe(1);
  });
});
