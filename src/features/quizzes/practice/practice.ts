import type { QuizPracticeSession } from '../types';

export type Team = 'red' | 'yellow';
export type AttemptType = 'original' | 'reread';
export type AttemptResult = 'correct' | 'incorrect' | 'nr';
export type QuestionState = 'not-attempted' | 'original-in-progress' | 'awaiting-reread' | 'reread-in-progress' | 'completed';

export interface InterruptionAnchor { textRevision: string; wordIndex: number; charOffset: number; }
export interface Attempt {
  id: string;
  questionId: string;
  quizzerId?: string;
  team?: Team;
  sequence: number;
  type: AttemptType;
  result: AttemptResult;
  interrupted: boolean;
  interruption?: InterruptionAnchor;
  createdAt: string;
}
export interface PracticeSession extends QuizPracticeSession {
  createdAt: string;
  roster: { red: number; yellow: number };
  attempts: Attempt[];
  states: Record<string, QuestionState>;
}

export function makeSession(quizId: string): PracticeSession {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), quizId, createdAt: now, updatedAt: now, roster: { red: 3, yellow: 3 }, attempts: [], states: {} };
}

function withAttempts(session: PracticeSession, questionId: string, attempts: Attempt[]): PracticeSession {
  let latest: Attempt | undefined;
  for (let index = attempts.length - 1; index >= 0; index -= 1) {
    if (attempts[index].questionId === questionId) {
      latest = attempts[index];
      break;
    }
  }
  const states = { ...session.states };
  if (!latest) delete states[questionId];
  else states[questionId] = latest.type === 'original' && latest.interrupted && latest.result === 'incorrect' ? 'awaiting-reread' : 'completed';
  return { ...session, updatedAt: new Date().toISOString(), attempts, states };
}

export function addAttempt(session: PracticeSession, input: Omit<Attempt, 'id' | 'sequence' | 'createdAt'>): PracticeSession {
  const sequence = session.attempts.reduce((last, attempt) => attempt.questionId === input.questionId ? Math.max(last, attempt.sequence) : last, 0) + 1;
  const attempt = { ...input, id: crypto.randomUUID(), sequence, createdAt: new Date().toISOString() };
  return withAttempts(session, input.questionId, [...session.attempts, attempt]);
}

export function updateAttempt(session: PracticeSession, attempt: Attempt, result: AttemptResult): PracticeSession {
  return withAttempts(session, attempt.questionId, session.attempts.map(item => item.id === attempt.id ? { ...item, result } : item));
}

export function removeAttempt(session: PracticeSession, attempt: Attempt): PracticeSession {
  return withAttempts(session, attempt.questionId, session.attempts.filter(item => item.id !== attempt.id));
}

export type QuestionTextSegment = { kind: 'text'; text: string } | { kind: 'word'; text: string; wordIndex: number; charOffset: number };

export function questionTextSegments(text: string): QuestionTextSegment[] {
  const segments: QuestionTextSegment[] = [];
  let cursor = 0;
  for (const [wordIndex, match] of [...text.matchAll(/\S+/g)].entries()) {
    const charOffset = match.index ?? cursor;
    if (charOffset > cursor) segments.push({ kind: 'text', text: text.slice(cursor, charOffset) });
    segments.push({ kind: 'word', text: match[0], wordIndex, charOffset });
    cursor = charOffset + match[0].length;
  }
  if (cursor < text.length) segments.push({ kind: 'text', text: text.slice(cursor) });
  return segments;
}
