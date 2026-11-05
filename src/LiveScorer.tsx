import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Eye, EyeOff, Pause, Play, Search, Save, Undo2 } from 'lucide-react';
import { searchVerses } from './search';
import { projectVersesForDivision } from './division';
import { activeQuizzerIndices, addScoreEvent, createLiveSession, currentContest, profileForDivision, questionsUntilLock, resetQuestion, setCurrentQuestion, summarizeSession, type ContestResult, type LiveSession, type ScoreEvent, type ScoreEventKind, type TeamSide, type TimeoutKind } from './scorer';
import { AnnotatedVerse, type StudyMarkingPreferences } from './AnnotatedVerse';
import type { AnalysisReport } from './analysis';
import type { Division, ScripturePack } from './types';

type Contest = ContestResult;
type EventExtra = { quizzer?: number; interrupted?: boolean; contest?: Contest };

export function LiveScorer({ initialSession, pack, division, analysisReport, studyMarkings, onSave, onExit }: { initialSession?: LiveSession; pack: ScripturePack; division: Division; analysisReport: AnalysisReport | null; studyMarkings: StudyMarkingPreferences; onSave: (session: LiveSession) => void; onExit: () => void }) {
  const [session, setSession] = useState<LiveSession>(() => initialSession ?? createLiveSession(division));
  const [lookup, setLookup] = useState('');
  const [activeSide, setActiveSide] = useState<TeamSide>('red');
  const [activeSlot, setActiveSlot] = useState(0);
  const [interruptions, setInterruptions] = useState<Record<string, boolean>>({});
  const [timer, setTimer] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [setupOpen, setSetupOpen] = useState(!initialSession);
  const [showColorCoding, setShowColorCoding] = useState(true);
  const [endPromptOpen, setEndPromptOpen] = useState(false);
  const [endPromptDismissed, setEndPromptDismissed] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const profile = profileForDivision(session.division);
  const summary = summarizeSession(session);
  const verses = useMemo(() => projectVersesForDivision(pack.verses, division), [pack.verses, division]);
  const lookupResults = useMemo(() => lookup.trim() ? searchVerses(verses, lookup).slice(0, 8) : [], [lookup, verses]);
  const markingPreferences = showColorCoding ? studyMarkings : { uniqueBeginning: false, uniqueEnding: false, frequency1: false, frequency2: false, frequency3: false };
  const value = summary.questionValues[session.currentQuestion - 1];
  const hasOvertimeEvents = session.events.some(event => event.question > profile.regulationQuestions);
  const visibleQuestionValues = session.overtimeStarted || hasOvertimeEvents ? summary.questionValues : summary.questionValues.slice(0, profile.regulationQuestions);
  const pointsLeft = visibleQuestionValues.slice(session.currentQuestion - 1).reduce((total, points) => total + points, 0);
  const displaySummary = { ...summary, questionValues: visibleQuestionValues };
  const displayLocked = Math.abs(summary.red.score - summary.yellow.score) > pointsLeft;
  const displayLockReason = displayLocked ? `${summary.red.score > summary.yellow.score ? session.red.name : session.yellow.name} is locked — the lead cannot be overcome with the remaining questions` : undefined;
  const currentResponse = [...session.events].reverse().find(event => event.question === session.currentQuestion && (event.kind === 'correct' || event.kind === 'error' || event.kind === 'no-response'));

  const startTimer = (seconds: number) => { setTimer(seconds); setTimerRunning(true); };
  useEffect(() => { void onSave(session); }, [session]);
  useEffect(() => { if (session.quizEnded && !session.quizClosed && !endPromptDismissed) setEndPromptOpen(true); if (!session.quizEnded) setEndPromptDismissed(false); }, [session.quizEnded, session.quizClosed, endPromptDismissed]);
  useEffect(() => { if (!timerRunning || timer <= 0) return; const handle = window.setInterval(() => setTimer(current => { if (current <= 1) { setTimerRunning(false); return 0; } return current - 1; }), 1000); return () => window.clearInterval(handle); }, [timerRunning, timer]);
  const emit = (side: TeamSide, kind: ScoreEventKind, extra: EventExtra = {}) => {
    setTimer(0); setTimerRunning(false);
    setSession(current => {
      const next = addScoreEvent(current, { question: current.currentQuestion, side, kind, ...extra });
      const advances = kind === 'correct' || kind === 'no-response' || (kind === 'error' && !extra.interrupted) || (kind === 'contest' && extra.contest !== 'granted');
      let positioned = next;
      if (advances) {
        const after = summarizeSession(next);
        if (current.currentQuestion > profile.regulationQuestions && after.red.score !== after.yellow.score) {
          positioned = { ...next, quizEnded: true, overtimeStarted: false };
        } else if (current.currentQuestion === profile.regulationQuestions && after.red.score !== after.yellow.score) {
          positioned = { ...next, quizEnded: true, overtimeStarted: false };
        } else if (current.currentQuestion === profile.regulationQuestions && after.red.score === after.yellow.score && profile.continuationValues.length) {
          positioned = { ...setCurrentQuestion(next, next.currentQuestion + 1), overtimeStarted: true, quizEnded: false };
        } else {
          positioned = setCurrentQuestion(next, next.currentQuestion + 1);
        }
      }
      if ((kind === 'correct' || kind === 'error') && extra.quizzer !== undefined && !positioned.quizEnded) {
        const beforeTeam = summarizeSession(current)[side];
        const afterTeam = summarizeSession(positioned)[side];
        const quizzedOut = !afterTeam.quizzers[extra.quizzer]?.eligible && beforeTeam.quizzers[extra.quizzer]?.eligible;
        const active = activeQuizzerIndices(current[side]);
        const board = (current[side].board ?? active.slice(0, 3)).filter(index => active.includes(index));
        const slot = board.indexOf(extra.quizzer);
        const available = active.find(index => !board.includes(index) && afterTeam.quizzers[index]?.eligible);
        if (quizzedOut && slot >= 0 && available !== undefined) positioned = { ...positioned, pendingSubstitution: { side, quizzer: extra.quizzer, slot } };
      }
      return positioned;
    });
    if (kind === 'correct' || kind === 'no-response' || (kind === 'error' && !extra.interrupted) || (kind === 'contest' && extra.contest !== 'granted')) setInterruptions({});
  };
  const emitQuestion = (kind: ScoreEventKind) => {
    setTimer(0); setTimerRunning(false); setInterruptions({});
    setSession(current => {
      const next = addScoreEvent(current, { question: current.currentQuestion, side: 'question', kind });
      if (current.currentQuestion > profile.regulationQuestions) {
        const after = summarizeSession(next);
        return after.red.score !== after.yellow.score ? { ...next, quizEnded: true, overtimeStarted: false } : setCurrentQuestion(next, next.currentQuestion + 1);
      }
      if (current.currentQuestion === profile.regulationQuestions) {
        const after = summarizeSession(next);
        return after.red.score === after.yellow.score && profile.continuationValues.length ? { ...setCurrentQuestion(next, next.currentQuestion + 1), overtimeStarted: true, quizEnded: false } : { ...next, quizEnded: true, overtimeStarted: false };
      }
      return setCurrentQuestion(next, next.currentQuestion + 1);
    });
  };
  const startContest = (side: TeamSide) => {
    if (session.quizClosed) return;
    setTimer(60); setTimerRunning(true); setInterruptions({});
    setSession(current => {
      const previousQuestion = current.currentQuestion - 1;
      const lastQuestion = summarizeSession(current).questionValues.length;
      const responseOnCurrent = current.events.some(event => event.question === current.currentQuestion && (event.kind === 'correct' || event.kind === 'error' || event.kind === 'no-response'));
      const canMoveToPrevious = current.currentQuestion > 1 && current.currentQuestion !== lastQuestion && (current.currentQuestion !== profile.regulationQuestions || !responseOnCurrent);
      const targetQuestion = canMoveToPrevious ? previousQuestion : current.currentQuestion;
      const positioned = targetQuestion === current.currentQuestion ? current : setCurrentQuestion(current, targetQuestion);
      return addScoreEvent(positioned, { question: targetQuestion, side, kind: 'contest', contest: 'pending' });
    });
  };
  const emitTimeout = (side: TeamSide, timeout: TimeoutKind) => {
    startTimer(60);
    setSession(current => addScoreEvent(current, { question: Math.max(1, current.currentQuestion - 1), side, kind: 'timeout', timeout }));
  };
  const move = (delta: number) => { setTimer(0); setTimerRunning(false); setInterruptions({}); setSession(current => { const target = current.currentQuestion + delta; const hasOt = current.overtimeStarted || current.events.some(event => event.question > profile.regulationQuestions); if (target > profile.regulationQuestions && !hasOt) return current; return setCurrentQuestion(current, target); }); };
  const choose = (side: TeamSide, slot: number) => { setActiveSide(side); setActiveSlot(slot); startTimer(profile.responseSeconds); };
  const toggleInterrupt = (side: TeamSide, slot: number) => setInterruptions(current => ({ ...current, [`${side}-${slot}`]: !current[`${side}-${slot}`] }));
  const updateTeam = (side: TeamSide, name: string) => setSession(current => ({ ...current, [side]: { ...current[side], name }, updatedAt: new Date().toISOString() }));
  const updateQuizzer = (side: TeamSide, index: number, name: string) => setSession(current => ({ ...current, [side]: { ...current[side], quizzers: current[side].quizzers.map((item, i) => i === index ? name : item) }, updatedAt: new Date().toISOString() }));
  const substitute = (side: TeamSide, slot: number, quizzer: number) => setSession(current => ({ ...current, [side]: { ...current[side], board: [...(current[side].board ?? activeQuizzerIndices(current[side]).slice(0, 3)).slice(0, slot), quizzer, ...(current[side].board ?? activeQuizzerIndices(current[side]).slice(0, 3)).slice(slot + 1) ] }, pendingSubstitution: undefined, updatedAt: new Date().toISOString() }));
  const newGame = () => { if (window.confirm('Start a new score sheet? The current sheet will remain saved if you saved it.')) { setSession(createLiveSession(division)); setSetupOpen(true); } };
  const updateSetupTeam = (side: TeamSide, value: Partial<LiveSession['red']>) => setSession(current => ({ ...current, [side]: { ...current[side], ...value }, updatedAt: new Date().toISOString() }));
  return <section className="scorer-view" aria-label="Live scorer">
    <div className="scorer-heading"><div><button className="back-button" onClick={onExit}><ArrowLeft size={14}/> Back to lookup</button><span className="context-label">SCORE SHEET · {profile.name.toUpperCase()}</span><h1>Question {session.currentQuestion}<small> of {visibleQuestionValues.length} · {value} points</small></h1></div><div className="scorer-heading-actions"><button className="secondary-button compact" onClick={() => setSetupOpen(true)}>Quiz setup</button><button className="secondary-button compact" onClick={newGame}>New score sheet</button>{session.quizClosed ? <><button className="secondary-button compact" onClick={() => setSession(current => ({ ...current, quizClosed: false, updatedAt: new Date().toISOString() }))}>Reopen quiz</button><button className="secondary-button compact" onClick={() => setOverviewOpen(true)}>Overview</button></> : session.quizEnded && <button className="secondary-button compact" onClick={() => setEndPromptOpen(true)}>End quiz</button>}<button className="primary-button" onClick={() => onSave(session)}><Save size={14}/> Save game</button></div></div>
    <div className="score-status"><div><span className="context-label">SCORE</span><strong className="red-text">{summary.red.score}</strong><span>–</span><strong className="yellow-text">{summary.yellow.score}</strong></div><div className="lock-metrics"><span>Remaining <strong>{pointsLeft} pts</strong></span><span>Red lock: <strong>{questionsUntilLock(displaySummary, session.currentQuestion, 'red') === null ? '—' : questionsUntilLock(displaySummary, session.currentQuestion, 'red') === 0 ? 'now' : `${questionsUntilLock(displaySummary, session.currentQuestion, 'red')} q`}</strong></span><span>Yellow lock: <strong>{questionsUntilLock(displaySummary, session.currentQuestion, 'yellow') === null ? '—' : questionsUntilLock(displaySummary, session.currentQuestion, 'yellow') === 0 ? 'now' : `${questionsUntilLock(displaySummary, session.currentQuestion, 'yellow')} q`}</strong></span></div><div className="timer-controls"><strong>{timer ? `${Math.floor(timer / 60)}:${String(timer % 60).padStart(2, '0')}` : 'Timer ready'}</strong>{timerRunning ? <button onClick={() => setTimerRunning(false)} aria-label="Pause timer"><Pause size={14}/></button> : <button onClick={() => setTimerRunning(true)} disabled={!timer} aria-label="Resume timer"><Play size={14}/></button>}<button onClick={() => startTimer(5)}>5</button><button onClick={() => startTimer(30)}>30</button><button onClick={() => startTimer(60)}>60</button><button onClick={() => startTimer(600)}>10m</button></div>{session.quizEnded ? <span className="lock-alert">Regulation complete — quiz ended</span> : displayLocked && <span className="lock-alert">{displayLockReason}</span>}</div>
    <div className="question-strip">{visibleQuestionValues.map((questionValue, index) => <button key={index} className={index + 1 === session.currentQuestion ? 'current' : session.events.some(event => event.question === index + 1) ? 'answered' : ''} onClick={() => { setTimer(0); setTimerRunning(false); setInterruptions({}); setSession(current => setCurrentQuestion(current, index + 1)); }}>Q{index + 1}<small>{questionValue}</small></button>)}{!session.overtimeStarted && !session.quizEnded && <span className="ot-hint">OT appears only if regulation ends tied</span>}{session.overtimeStarted && <span className="ot-hint">Overtime</span>}</div>
    <div className="scorer-grid"><div className="scorer-main"><TeamSheet side="red" team={session.red} summary={summary.red} response={currentResponse} contestStatus={currentContest(session, 'red')} activeSide={activeSide} activeSlot={activeSlot} interruptions={interruptions} onSelect={choose} onInterrupt={toggleInterrupt} onTeamName={value => updateTeam('red', value)} onSubstitute={substitute} onTimeout={emitTimeout} onContestStart={startContest} onEvent={emit}/><div className="question-nav"><button onClick={() => move(-1)} disabled={session.currentQuestion === 1}><ChevronLeft size={16}/> Previous question</button><button className="reset-question" onClick={() => { setTimer(0); setTimerRunning(false); setInterruptions({}); setSession(current => resetQuestion(current)); }}>Reset question</button><button className={`neutral-event ${currentResponse?.side === 'question' ? 'response-selected' : ''}`} onClick={() => emitQuestion('no-response')}>No response</button><span>{currentResponse ? 'Selected response · choose C/E to replace' : `Q${session.currentQuestion} · ${value} points`}</span><button onClick={() => move(1)} disabled={session.quizEnded || session.currentQuestion === visibleQuestionValues.length}>Next question <ChevronRight size={16}/></button></div><TeamSheet side="yellow" team={session.yellow} summary={summary.yellow} response={currentResponse} contestStatus={currentContest(session, 'yellow')} activeSide={activeSide} activeSlot={activeSlot} interruptions={interruptions} onSelect={choose} onInterrupt={toggleInterrupt} onTeamName={value => updateTeam('yellow', value)} onSubstitute={substitute} onTimeout={emitTimeout} onContestStart={startContest} onEvent={emit}/><div className="event-history"><div className="section-label">Recent score sheet events <button onClick={() => setSession(current => ({ ...current, events: current.events.slice(0, -1), updatedAt: new Date().toISOString() }))} disabled={!session.events.length}><Undo2 size={13}/> Undo last</button></div>{session.events.slice(-10).reverse().map(event => <div key={event.id}><span>Q{event.question}</span><strong>{event.side === 'question' ? 'QUESTION' : event.side.toUpperCase()} · {event.kind}</strong>{event.quizzer !== undefined && event.side !== 'question' && <small>{session[event.side].quizzers[event.quizzer]}</small>}{event.interrupted && <em>interrupted</em>}{event.contest && <em>{event.contest}</em>}</div>)}</div></div>
      <aside className="scorer-lookup"><div className="section-label"><Search size={14}/> Scripture lookup <button className="lookup-color-toggle" onClick={() => setShowColorCoding(value => !value)} aria-pressed={showColorCoding} title={showColorCoding ? 'Turn color coding off' : 'Turn color coding on'}>{showColorCoding ? <Eye size={14}/> : <EyeOff size={14}/>}<span className="sr-only">{showColorCoding ? 'Color coding on' : 'Color coding off'}</span></button></div><input value={lookup} onChange={event => setLookup(event.target.value)} placeholder="Reference, word, or phrase…" aria-label="Scorer Scripture lookup"/>{lookupResults.map(result => <article key={result.verse.id}><strong>{result.verse.book} {result.verse.chapter}:{result.verse.verse} · #{result.verse.studyNumber}</strong><p><AnnotatedVerse verseId={result.verse.id} text={result.verse.text} annotations={analysisReport?.annotations.filter(annotation => annotation.verseId === result.verse.id) ?? []} preferences={markingPreferences}/></p></article>)}{!lookup && <p className="muted">Search the active BQLookup material without leaving the score sheet.</p>}</aside>
    </div>{session.pendingSubstitution && <SubstitutionPrompt session={session} pending={session.pendingSubstitution} onChoose={substitute}/>} {endPromptOpen && <EndQuizPrompt onContinue={() => { setEndPromptOpen(false); setEndPromptDismissed(true); }} onEnd={() => { setEndPromptOpen(false); setEndPromptDismissed(true); setSession(current => ({ ...current, quizClosed: true, updatedAt: new Date().toISOString() })); }} onOverview={() => { setEndPromptOpen(false); setEndPromptDismissed(true); setSession(current => ({ ...current, quizClosed: true, updatedAt: new Date().toISOString() })); setOverviewOpen(true); }}/>} {overviewOpen && <QuizOverview session={session} summary={summary} onClose={() => setOverviewOpen(false)}/>} {setupOpen && <QuizSetup session={session} onTeam={updateSetupTeam} onQuizzer={updateQuizzer} onClose={() => setSetupOpen(false)}/>} 
  </section>;
}

function TeamSheet({ side, team, summary, response, contestStatus, activeSide, activeSlot, interruptions, onSelect, onInterrupt, onTeamName, onSubstitute, onTimeout, onContestStart, onEvent }: { side: TeamSide; team: LiveSession['red']; summary: ReturnType<typeof summarizeSession>['red']; response?: ScoreEvent; contestStatus: ContestResult | null; activeSide: TeamSide; activeSlot: number; interruptions: Record<string, boolean>; onSelect: (side: TeamSide, slot: number) => void; onInterrupt: (side: TeamSide, slot: number) => void; onTeamName: (value: string) => void; onSubstitute: (side: TeamSide, slot: number, quizzer: number) => void; onTimeout: (side: TeamSide, timeout: TimeoutKind) => void; onContestStart: (side: TeamSide) => void; onEvent: (side: TeamSide, kind: ScoreEventKind, extra?: EventExtra) => void }) {
  const active = activeQuizzerIndices(team);
  const configuredBoard = (team.board ?? []).filter(index => active.includes(index));
  const board = [...configuredBoard, ...active.filter(index => !configuredBoard.includes(index))].slice(0, 3);
  const priorQuizzer = response?.side === side && response.quizzer !== undefined && !board.includes(response.quizzer) ? response.quizzer : undefined;
  return <section className={`team-sheet ${side}`}><div className="team-sheet-heading"><input value={team.name} onChange={event => onTeamName(event.target.value)} aria-label={`${side} team name`}/><strong>{summary.score}</strong><span>TO {summary.standardTimeoutsRemaining} · Sub {summary.substitutionTimeoutsRemaining} · W {summary.withdrawnContestsRemaining} · D {summary.deniedContestsRemaining}</span></div>{contestStatus === 'granted' && <div className="granted-contest-note">Contest granted — reread response: choose C or E to replace the highlighted ruling.</div>}{priorQuizzer !== undefined && response && <div className="prior-response"><strong>Prior response · {team.quizzers[priorQuizzer]}</strong><button className={response.kind === 'correct' ? 'response-selected' : 'result-correct'} onClick={() => onEvent(side, 'correct', { quizzer: priorQuizzer })}>C</button><button className={response.kind === 'error' ? 'response-selected' : 'result-error'} onClick={() => onEvent(side, 'error', { quizzer: priorQuizzer })}>E</button><span>Quizzer is no longer on the current board</span></div>}{board.map((quizzerIndex, slot) => { const interrupted = Boolean(interruptions[`${side}-${slot}`]); const stats = summary.quizzers[quizzerIndex] ?? { correct: 0, errors: 0, fouls: 0, eligible: true, quizOut: false }; const selectedCorrect = response?.side === side && response.quizzer === quizzerIndex && response.kind === 'correct'; const selectedError = response?.side === side && response.quizzer === quizzerIndex && response.kind === 'error'; return <div className={`board-row ${activeSide === side && activeSlot === slot ? 'selected' : ''} ${!stats.eligible ? 'ineligible' : ''}`} key={slot}><select value={quizzerIndex} onChange={event => onSubstitute(side, slot, Number(event.target.value))} aria-label={`${side} board position ${slot + 1}`}>{activeQuizzerIndices(team).map(index => <option key={index} value={index}>{team.quizzers[index]}</option>)}</select><button className="buzz-button" onClick={() => onSelect(side, slot)}>{side === 'red' ? 'R' : 'Y'}{slot + 1}</button><button className={interrupted ? 'toggle-on' : ''} onClick={() => { onSelect(side, slot); onInterrupt(side, slot); }}>I</button><button className={`result-correct ${selectedCorrect ? 'response-selected' : ''}`} onClick={() => onEvent(side, 'correct', { quizzer: quizzerIndex, interrupted })}>C</button><button className={`result-error ${selectedError ? 'response-selected' : ''}`} onClick={() => onEvent(side, 'error', { quizzer: quizzerIndex, interrupted })}>E</button><button className="result-foul" onClick={() => onEvent(side, 'foul', { quizzer: quizzerIndex })}>F</button><span className="quizzer-stats">{stats.correct}C · {stats.errors}E · {stats.fouls}F{stats.quizOut ? ' · OUT' : ''}</span></div>; })}<div className="team-actions"><button disabled={summary.standardTimeoutsRemaining <= 0} onClick={() => onTimeout(side, 'standard')}>Timeout ({summary.standardTimeoutsRemaining})</button><button disabled={summary.substitutionTimeoutsRemaining <= 0} onClick={() => onTimeout(side, 'substitution')}>Sub timeout ({summary.substitutionTimeoutsRemaining})</button><button onClick={() => onEvent(side, 'team-foul')}>Team foul (-5)</button><button disabled={!summary.contestEligible || contestStatus === 'pending' || contestStatus === 'granted'} className={!summary.contestEligible || contestStatus === 'pending' || contestStatus === 'granted' ? 'contest-pending' : ''} onClick={() => onContestStart(side)}>{!summary.contestEligible ? 'Contests unavailable' : contestStatus === 'pending' ? 'Contest pending' : contestStatus === 'granted' ? 'Contest granted · reread' : 'Start contest'}</button>{contestStatus === 'pending' && <details open><summary>Resolve</summary><div><button onClick={() => onEvent(side, 'contest', { contest: 'withdrawn' })}>W Withdrawn</button><button onClick={() => onEvent(side, 'contest', { contest: 'denied' })}>D Denied</button><button onClick={() => onEvent(side, 'contest', { contest: 'granted' })}>G Granted</button></div></details>}</div></section>;
}

function SubstitutionPrompt({ session, pending, onChoose }: { session: LiveSession; pending: NonNullable<LiveSession['pendingSubstitution']>; onChoose: (side: TeamSide, slot: number, quizzer: number) => void }) {
  const team = session[pending.side];
  const rosterSize = team.rosterSize ?? team.quizzers.length;
  const board = (team.board ?? [0, 1, 2]).filter(index => index < rosterSize);
  const available = team.quizzers.slice(0, rosterSize).map((name, index) => ({ name, index })).filter(item => !board.includes(item.index));
  return <div className="setup-backdrop"><section className="quiz-setup substitution-prompt" role="dialog" aria-modal="true"><span className="context-label">QUIZZER OUT</span><h2>{team.quizzers[pending.quizzer]} has quizzed out</h2><p className="muted">Choose an available {pending.side === 'red' ? 'red' : 'yellow'} quizzer to take board position {pending.slot + 1}.</p>{available.length ? <div className="substitution-options">{available.map(item => <button key={item.index} className="primary-button" onClick={() => onChoose(pending.side, pending.slot, item.index)}>{item.name}</button>)}</div> : <p>No registered substitute is available. Add one in Quiz setup.</p>}</section></div>;
}

function EndQuizPrompt({ onContinue, onEnd, onOverview }: { onContinue: () => void; onEnd: () => void; onOverview: () => void }) {
  return <div className="setup-backdrop"><section className="quiz-setup end-quiz-prompt" role="dialog" aria-modal="true" aria-labelledby="end-quiz-title"><span className="context-label">REGULATION COMPLETE</span><h2 id="end-quiz-title">End this quiz?</h2><p className="muted">The quiz is not officially closed yet. Keep editing if a final-question contest or ruling change is still possible.</p><div className="end-quiz-actions"><button className="secondary-button" onClick={onContinue}>Keep editing</button><button className="secondary-button" onClick={onOverview}>End quiz & view overview</button><button className="primary-button" onClick={onEnd}>End quiz</button></div></section></div>;
}

function QuizOverview({ session, summary, onClose }: { session: LiveSession; summary: ReturnType<typeof summarizeSession>; onClose: () => void }) {
  const eventCount = session.events.length;
  return <div className="setup-backdrop"><section className="quiz-setup quiz-overview" role="dialog" aria-modal="true" aria-labelledby="quiz-overview-title"><div className="setup-heading"><div><span className="context-label">QUIZ OVERVIEW</span><h2 id="quiz-overview-title">{session.red.name} · {summary.red.score} — {summary.yellow.score} · {session.yellow.name}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close quiz overview">×</button></div><div className="overview-grid"><OverviewTeam name={session.red.name} team={summary.red}/><OverviewTeam name={session.yellow.name} team={summary.yellow}/></div><p className="muted">{eventCount} recorded score-sheet events · {session.overtimeStarted ? 'Overtime played' : 'Regulation only'}</p></section></div>;
}

function OverviewTeam({ name, team }: { name: string; team: ReturnType<typeof summarizeSession>['red'] }) {
  return <article className="overview-team"><h3>{name} <strong>{team.score}</strong></h3><p>Timeouts remaining: {team.standardTimeoutsRemaining} · Substitution timeouts: {team.substitutionTimeoutsRemaining}</p><p>Contests remaining: {team.withdrawnContestsRemaining} withdrawn · {team.deniedContestsRemaining} denied</p><div>{team.quizzers.map((quizzer, index) => <span key={index}>{index + 1}. {quizzer.correct}C · {quizzer.errors}E · {quizzer.fouls}F{quizzer.quizOut ? ' · OUT' : ''}</span>)}</div></article>;
}

function QuizSetup({ session, onTeam, onQuizzer, onClose }: { session: LiveSession; onTeam: (side: TeamSide, value: Partial<LiveSession['red']>) => void; onQuizzer: (side: TeamSide, index: number, name: string) => void; onClose: () => void }) {
  return <div className="setup-backdrop"><section className="quiz-setup" role="dialog" aria-modal="true" aria-labelledby="quiz-setup-title"><div className="setup-heading"><div><span className="context-label">QUIZ SETUP</span><h2 id="quiz-setup-title">Prepare the score sheet</h2></div><button className="icon-button" onClick={onClose} aria-label="Close quiz setup">×</button></div><p className="muted">Enter the roster and select the quizzers available for this quiz. At least two must be selected.</p><div className="setup-teams">{(['red', 'yellow'] as TeamSide[]).map(side => { const active = activeQuizzerIndices(session[side]); const enabled = session[side].rosterEnabled ?? session[side].quizzers.map((_, index) => index < (session[side].rosterSize ?? session[side].quizzers.length)); return <div className={`setup-team ${side}`} key={side}><label>{side === 'red' ? 'Red' : 'Yellow'} team<input value={session[side].name} onChange={event => onTeam(side, { name: event.target.value })}/></label><strong>Quizzers</strong>{session[side].quizzers.map((name, index) => <div className="roster-entry" key={index}><input value={name} placeholder={`Quizzer ${index + 1}`} onChange={event => onQuizzer(side, index, event.target.value)} aria-label={`${side} quizzer ${index + 1} name`}/><label className="roster-toggle"><input type="checkbox" checked={Boolean(enabled[index])} disabled={Boolean(enabled[index]) && active.length <= 2} aria-label={`${side} quizzer ${index + 1} available`} onChange={event => { const next = [...enabled]; next[index] = event.target.checked; const currentBoard = session[side].board ?? active.slice(0, 3); const nextActive = next.map((isEnabled, boardIndex) => isEnabled ? boardIndex : -1).filter(boardIndex => boardIndex >= 0); const nextBoard = [...currentBoard.filter(boardIndex => next[boardIndex]), ...nextActive.filter(boardIndex => !currentBoard.includes(boardIndex))].slice(0, 3); onTeam(side, { rosterEnabled: next, rosterSize: nextActive.length, board: nextBoard }); }}/></label></div>)}<small>Selected quizzers appear on the board; unselected roster members remain available for later substitution.</small></div>; })}</div><button className="primary-button setup-start" onClick={onClose}>Start scoring</button></section></div>;
}
