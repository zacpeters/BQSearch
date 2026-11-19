// Adapted from the pinned standalone BQQuiz V5 PracticeViewerV5.
import { Fragment, useEffect, useMemo, useState } from 'react';
import type { ScriptureLookupResult, ScriptureProvider, ScriptureReference } from '../../../integration/contracts';
import type { QuizQuestion } from '../types';
import { displayClassification, formatReference } from '../v5-format';
import { addAttempt, makeSession, questionTextSegments, removeAttempt, updateAttempt, type Attempt, type AttemptResult, type PracticeSession, type QuestionState, type Team } from './practice';

export type PracticeQuiz = { id: string; title: string; questionIds: string[] };

type Props = {
  quiz: PracticeQuiz;
  questions: (QuizQuestion | undefined)[];
  session: PracticeSession;
  save: (next: PracticeSession) => Promise<boolean>;
  saving: boolean;
  saveError: string;
  scriptureProvider: ScriptureProvider;
  onBack: () => void;
};

const quizzerIds = { red: ['R1', 'R2', 'R3'], yellow: ['Y1', 'Y2', 'Y3'] } as const;
const questionAnchor = (index: number) => `practice-question-${index + 1}`;
const resultLabel = { correct: 'Correct', incorrect: 'Incorrect', nr: 'NR' };
const resultCode = { correct: 'C', incorrect: 'E', nr: 'NR' };

export function PracticeViewerV5({ quiz, questions, session, save, saving, saveError, scriptureProvider, onBack }: Props) {
  const [undo, setUndo] = useState<PracticeSession | null>(null);
  const [reviewPrint, setReviewPrint] = useState(false);
  const [scripture, setScripture] = useState<ScriptureReference | null>(null);
  const attempts = useMemo(() => [...session.attempts].reverse().sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [session.attempts]);
  const available = questions.filter(question => question !== undefined);
  const missing = quiz.questionIds.length - available.length;
  const possiblePoints = available.reduce((sum, question) => sum + question.pointValue, 0);

  const mutate = async (next: PracticeSession) => {
    if (!await save(next)) return false;
    setUndo(session);
    return true;
  };
  const undoLast = async () => {
    if (undo && await save({ ...undo, updatedAt: new Date().toISOString() })) setUndo(null);
  };
  const reset = async () => {
    if (!confirm('Reset this practice session? A new session will start and the previous history will be kept.')) return;
    if (await save(makeSession(quiz.id))) setUndo(null);
  };

  return (
    <section className="practice-page bqquiz-v5" aria-label="Practice quiz" data-review-print={reviewPrint}>
      <div className="practice-header">
        <button className="back-button" onClick={onBack}>‹ <span>Library</span></button>
        <div><span className="overline">PRACTICE</span><h1 title={quiz.title}>{quiz.title}</h1></div>
        <div className="practice-actions">
          <button className="button ghost" onClick={() => setReviewPrint(!reviewPrint)}>{reviewPrint ? 'Clean print' : 'Review print'}</button>
          <button className="button ghost" disabled={saving} onClick={() => void reset()}>Reset Practice</button>
          <button className="button primary" disabled={saving} onClick={() => window.print()}>{reviewPrint ? 'Print review' : 'Print quiz'}</button>
        </div>
      </div>
      {saveError && <p className="practice-save-error" role="alert">{saveError}</p>}
      <div className="practice-layout">
        <div>
          <div className="practice-subbar">
            <span>{quiz.questionIds.length} questions · {possiblePoints} possible points{missing > 0 && ` · ${missing} unavailable`}</span>
            <span className="saved-label" role="status">{saving ? 'Saving…' : saveError ? 'Save failed' : '● Saved'}</span>
          </div>
          <div className="practice-sheet">
            <div className="practice-sheet-head"><span className="overline">QUIZ</span><h2>{quiz.title}</h2></div>
            {quiz.questionIds.map((questionId, index) => {
              const question = questions[index];
              const key = `${session.id}-${questionId}-${index}`;
              return question ? <PracticeQuestion key={key} question={question} index={index} state={session.states[question.id]}
                attempts={session.attempts.filter(a => a.questionId === question.id)} saving={saving}
                onAttempt={data => mutate(addAttempt(session, data))}
                onReference={setScripture}
                onRemove={attempt => void mutate(removeAttempt(session, attempt))}
                onUpdate={attempt => void mutate(updateAttempt(session, attempt, attempt.result === 'correct' ? 'incorrect' : 'correct'))}/>
                : <article key={key} className="practice-question" id={questionAnchor(index)}>
                  <div className="question-topline"><span className="question-number">{String(index + 1).padStart(2, '0')}</span></div>
                  <p className="unavailable">Question unavailable. <code>{questionId}</code></p>
                </article>;
            })}
          </div>
        </div>
        <aside className="activity-log" aria-label="Practice activity">
          <div className="log-head"><strong>Activity</strong><button className="text-button" disabled={!undo || saving} onClick={() => void undoLast()}>Undo</button></div>
          {attempts.length === 0 && <p className="quiet">No attempts</p>}
          {attempts.map(attempt => {
            const index = quiz.questionIds.indexOf(attempt.questionId);
            return (
              <button className="log-entry" key={attempt.id} disabled={index < 0} onClick={() => document.getElementById(questionAnchor(index))?.scrollIntoView({ block: 'center' })}>
                <span>Q{index < 0 ? '—' : index + 1}</span>
                <b className={attempt.result}>{attempt.quizzerId ?? attempt.team ?? '—'}</b>
                <strong>{resultCode[attempt.result]}</strong>
                <small>{attempt.interrupted ? 'I · ' : ''}{attempt.type === 'original' ? 'Original' : 'Reread'}</small>
              </button>
            );
          })}
          {Object.entries(session.states).filter(([, state]) => state === 'awaiting-reread').map(([id]) => {
            const number = quiz.questionIds.indexOf(id) + 1;
            return <div className="pending-reread" key={id}>Q{number || '—'} · reread pending</div>;
          })}
        </aside>
      </div>
      {scripture && <ScriptureDrawer key={formatReference(scripture)} reference={scripture} provider={scriptureProvider} onClose={() => setScripture(null)}/>}
    </section>
  );
}

type QuestionProps = {
  question: QuizQuestion;
  index: number;
  state?: QuestionState;
  attempts: Attempt[];
  saving: boolean;
  onAttempt: (data: Parameters<typeof addAttempt>[1]) => Promise<boolean>;
  onReference: (ref: ScriptureReference) => void;
  onRemove: (attempt: Attempt) => void;
  onUpdate: (attempt: Attempt) => void;
};

function PracticeQuestion({ question: q, index, state, attempts, saving, onAttempt, onReference, onRemove, onUpdate }: QuestionProps) {
  const segments = useMemo(() => questionTextSegments(q.rawQuestion), [q.rawQuestion]);
  const references = q.references ?? [];
  const [armed, setArmed] = useState<Team | null>(null);
  const [anchor, setAnchor] = useState<{ wordIndex: number; charOffset: number }>();
  const [selected, setSelected] = useState<Partial<Record<Team, string>>>({});
  const [cancelledReread, setCancelledReread] = useState<string>();
  const [hiddenSlash, setHiddenSlash] = useState<string>();
  const [locked, setLocked] = useState(false);
  const latest = attempts[attempts.length - 1];
  const pending = state === 'awaiting-reread' && latest?.type === 'original' && latest.interrupted && latest.result === 'incorrect' ? latest : undefined;
  const reread = Boolean(pending && pending.id !== cancelledReread);
  const eligible: Team = pending?.team === 'red' ? 'yellow' : 'red';
  const recorded = attempts.find(a => a.interruption?.textRevision === q.textRevision);
  const savedAnchor = recorded?.interruption;
  const displayAnchor = reread ? undefined : anchor ?? (recorded?.id !== hiddenSlash ? savedAnchor : undefined);

  useEffect(() => {
    if (reread) setSelected({});
  }, [reread]);
  useEffect(() => {
    if (!pending) setCancelledReread(undefined);
  }, [pending]);
  useEffect(() => {
    if (!locked) return;
    const timer = window.setTimeout(() => setLocked(false), 700);
    return () => window.clearTimeout(timer);
  }, [locked]);

  const record = async (team: Team, result: AttemptResult) => {
    const quizzerId = result === 'nr' ? undefined : selected[team];
    if (locked || saving || (reread && team !== eligible) || (result !== 'nr' && !quizzerId)) return;
    const interruption = !reread && result !== 'nr' && displayAnchor ? { ...displayAnchor, textRevision: q.textRevision } : undefined;
    const saved = await onAttempt({
      questionId: q.id, quizzerId, team: result === 'nr' && !reread ? undefined : team,
      type: reread ? 'reread' : 'original', result, interrupted: Boolean(interruption), interruption,
    });
    if (!saved) return;
    setLocked(true);
    setAnchor(undefined);
    setArmed(null);
  };

  const row = (team: Team) => {
    const inactive = reread && team !== eligible;
    return (
      <div className={`record-row${armed === team ? ' armed' : ''}`} role="group" aria-label={`${team === 'red' ? 'Red' : 'Yellow'} team`}>
        <b>{team === 'red' ? 'Red' : 'Yellow'}</b>
        <button className="record-interrupt" aria-label={`${team} interruption`} aria-pressed={armed === team} disabled={reread || saving} onClick={() => setArmed(armed === team ? null : team)}>I</button>
        {quizzerIds[team].map(id => (
          <button key={id} className={selected[team] === id ? `quizzer selected ${team}` : 'quizzer'} aria-pressed={selected[team] === id} disabled={inactive || saving}
            onClick={() => setSelected({ ...selected, [team]: id })}>{id}</button>
        ))}
        <button title="Correct" disabled={inactive || saving || !selected[team] || locked} className="record-result correct" onClick={() => void record(team, 'correct')}>C</button>
        <button title="Error" disabled={inactive || saving || !selected[team] || locked} className="record-result incorrect" onClick={() => void record(team, 'incorrect')}>E</button>
      </div>
    );
  };

  const slashAt = (wordIndex: number) => <>
    {displayAnchor?.wordIndex === wordIndex && <i className="interruption-slash screen-slash">/</i>}
    {savedAnchor?.wordIndex === wordIndex && <i className="interruption-slash print-slash">/</i>}
  </>;

  return (
    <article className="practice-question always-visible" id={questionAnchor(index)}>
      <div className="question-topline">
        <span className="question-number">{String(index + 1).padStart(2, '0')}</span>
        <span className="point-tag">{q.pointValue} pts</span>
        <span className="classification-tag">{displayClassification(q.classification)}</span>
      </div>
      <div className="practice-question-text">
        {segments.map((segment, i) => segment.kind === 'text' ? <Fragment key={i}>{segment.text}</Fragment> :
          <span key={i}>{slashAt(segment.wordIndex)}<button className="tap-word" onClick={() => !reread && setAnchor({ wordIndex: segment.wordIndex, charOffset: segment.charOffset })}>{segment.text}</button></span>)}
        {slashAt(segments.filter(segment => segment.kind === 'word').length)}
      </div>
      <div className="answer-line"><span>ANS.</span><p>{q.rawAnswer}</p></div>
      {references.length > 0 ? <div className="reference-links">{references.map((ref, i) => <button key={i} onClick={() => onReference(ref)}>{formatReference(ref)}</button>)}</div>
        : <p className="unavailable missing-reference">No structured Scripture reference.</p>}
      <div className="record-controls">
        {reread && <span className="reread-label">Reread for {eligible === 'red' ? 'Red' : 'Yellow'}</span>}
        {row('red')}{row('yellow')}
        <div className="record-nr-row"><button className="record-nr" disabled={locked || saving} onClick={() => void record(reread ? eligible : 'red', 'nr')}>No Response</button></div>
        {displayAnchor && <button className="text-button" onClick={() => { setAnchor(undefined); setHiddenSlash(recorded?.id); }}>Remove slash</button>}
        {reread && <button className="text-button" onClick={() => { setCancelledReread(pending?.id); setSelected({}); }}>Cancel reread</button>}
      </div>
      {attempts.length > 0 && <div className="attempt-history">{attempts.map(attempt => (
        <div className="attempt-line" key={attempt.id}>
          <span className={`team-pill ${attempt.team ?? 'none'}`}>{attempt.quizzerId ?? '—'}</span>
          <b className={attempt.result}>{resultLabel[attempt.result]}</b>
          <span>{attempt.interruption ? '/ · ' : ''}{attempt.type === 'original' ? 'Original' : 'Reread'}
            {attempt.interruption && attempt.interruption.textRevision !== q.textRevision && ' · earlier question revision'}
          </span>
          <button disabled={saving} onClick={() => onUpdate(attempt)}>Correct / Incorrect</button>
          <button disabled={saving} onClick={() => onRemove(attempt)}>Remove</button>
        </div>
      ))}</div>}
    </article>
  );
}

function ScriptureDrawer({ reference, provider, onClose }: { reference: ScriptureReference; provider: ScriptureProvider; onClose: () => void }) {
  const [result, setResult] = useState<ScriptureLookupResult | null>();
  useEffect(() => {
    let active = true;
    void provider.getVerse(reference).then(
      value => { if (active) setResult(value); },
      () => { if (active) setResult(null); },
    );
    return () => { active = false; };
  }, [provider, reference]);
  return (
    <aside className="scripture-drawer" aria-label="Scripture reference">
      <button className="close-drawer" aria-label="Close Scripture reference" onClick={onClose}>×</button>
      <span className="overline">REFERENCE</span><h2>{formatReference(reference)}</h2>
      {result?.available ? <p className="scripture-text">{result.text}</p>
        : <p className="unavailable" role="status">{result === undefined ? 'Loading Scripture…'
          : result?.reason === 'outside-division' ? 'This reference is outside the active division.'
          : result?.reason === 'invalid-reference' ? 'This Scripture reference is invalid.'
          : 'Verified verse text is unavailable locally.'}</p>}
    </aside>
  );
}
