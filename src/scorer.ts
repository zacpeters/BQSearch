export type TeamSide = 'red' | 'yellow';
export type ScoreEventKind = 'correct' | 'error' | 'foul' | 'team-foul' | 'timeout' | 'no-response' | 'contest';
export type ContestResult = 'pending' | 'withdrawn' | 'denied' | 'granted';
export type TimeoutKind = 'standard' | 'substitution';

export interface DivisionProfile {
  id: string;
  name: string;
  quizOut: number;
  regulationQuestions: number;
  values: number[];
  continuationValues: number[];
  teamBonus: number;
  quizzerBonus: number;
  foulPenalty: number;
  maxFouls: number;
  maxErrors: number;
  responseSeconds: number;
  noResponseSeconds: number;
}

export const divisionProfiles: Record<string, DivisionProfile> = {
  Beginner: { id: 'beginner', name: 'Beginner', quizOut: 6, regulationQuestions: 15, values: [...Array(6).fill(10), ...Array(6).fill(20), ...Array(3).fill(30)], continuationValues: [...Array(4).fill(20)], teamBonus: 10, quizzerBonus: 10, foulPenalty: 5, maxFouls: 3, maxErrors: 5, responseSeconds: 30, noResponseSeconds: 5 },
  Junior: { id: 'junior', name: 'Junior', quizOut: 6, regulationQuestions: 15, values: [...Array(6).fill(10), ...Array(6).fill(20), ...Array(3).fill(30)], continuationValues: [...Array(4).fill(20)], teamBonus: 10, quizzerBonus: 10, foulPenalty: 5, maxFouls: 3, maxErrors: 5, responseSeconds: 30, noResponseSeconds: 5 },
  Intermediate: { id: 'intermediate', name: 'Intermediate', quizOut: 8, regulationQuestions: 20, values: [...Array(8).fill(10), ...Array(9).fill(20), ...Array(3).fill(30)], continuationValues: [...Array(8).fill(20), 10], teamBonus: 10, quizzerBonus: 10, foulPenalty: 5, maxFouls: 3, maxErrors: 5, responseSeconds: 30, noResponseSeconds: 5 },
  Experienced: { id: 'experienced', name: 'Experienced', quizOut: 8, regulationQuestions: 20, values: [...Array(8).fill(10), ...Array(9).fill(20), ...Array(3).fill(30)], continuationValues: [...Array(8).fill(20), 10], teamBonus: 10, quizzerBonus: 10, foulPenalty: 5, maxFouls: 3, maxErrors: 5, responseSeconds: 30, noResponseSeconds: 5 },
  ABLE: { id: 'able', name: 'ABLE', quizOut: 4, regulationQuestions: 10, values: [...Array(4).fill(10), ...Array(4).fill(20), ...Array(2).fill(30)], continuationValues: [...Array(4).fill(20)], teamBonus: 10, quizzerBonus: 10, foulPenalty: 5, maxFouls: 3, maxErrors: 5, responseSeconds: 30, noResponseSeconds: 5 },
};

export interface ScoreEvent {
  id: string;
  question: number;
  side: TeamSide | 'question';
  kind: ScoreEventKind;
  quizzer?: number;
  interrupted?: boolean;
  contest?: ContestResult;
  timeout?: TimeoutKind;
  createdAt: string;
}

export interface LiveTeam {
  name: string;
  quizzers: string[];
  board?: number[];
  rosterSize?: number;
  rosterEnabled?: boolean[];
}

export interface LiveSession {
  id: string;
  division: string;
  profileId: string;
  red: LiveTeam;
  yellow: LiveTeam;
  currentQuestion: number;
  events: ScoreEvent[];
  createdAt: string;
  updatedAt: string;
  overtimeStarted?: boolean;
  quizEnded?: boolean;
  quizClosed?: boolean;
  pendingSubstitution?: { side: TeamSide; quizzer: number; slot: number };
}

export interface QuizzerSummary { correct: number; errors: number; fouls: number; score: number; eligible: boolean; quizOut: boolean; }
export interface TeamSummary { score: number; bonus: number; quizzers: QuizzerSummary[]; standardTimeoutsUsed: number; standardTimeoutsRemaining: number; substitutionTimeoutsUsed: number; substitutionTimeoutsRemaining: number; withdrawnContests: number; deniedContests: number; withdrawnContestsRemaining: number; deniedContestsRemaining: number; contestEligible: boolean; }
export interface LiveSummary { red: TeamSummary; yellow: TeamSummary; questionValues: number[]; locked: boolean; lockReason?: string; }

export function profileForDivision(division: string): DivisionProfile {
  return divisionProfiles[division] ?? divisionProfiles.Intermediate;
}

export function questionValue(profile: DivisionProfile, question: number): number {
  return profile.values[question - 1] ?? profile.continuationValues[question - profile.values.length - 1] ?? profile.continuationValues[profile.continuationValues.length - 1] ?? 10;
}

export function createLiveSession(division: string, redName = 'Red Team', yellowName = 'Yellow Team'): LiveSession {
  const now = new Date().toISOString();
  return { id: `quiz-${Date.now()}`, division, profileId: profileForDivision(division).id, red: { name: redName, quizzers: ['Quizzer 1', 'Quizzer 2', 'Quizzer 3', 'Quizzer 4', 'Quizzer 5'], rosterSize: 5, rosterEnabled: [true, true, true, true, true], board: [0, 1, 2] }, yellow: { name: yellowName, quizzers: ['Quizzer 1', 'Quizzer 2', 'Quizzer 3', 'Quizzer 4', 'Quizzer 5'], rosterSize: 5, rosterEnabled: [true, true, true, true, true], board: [0, 1, 2] }, currentQuestion: 1, events: [], createdAt: now, updatedAt: now, overtimeStarted: false, quizEnded: false, quizClosed: false };
}

export function activeQuizzerIndices(team: LiveTeam): number[] {
  if (team.rosterEnabled) return team.rosterEnabled.map((enabled, index) => enabled ? index : -1).filter(index => index >= 0 && index < team.quizzers.length);
  const count = team.rosterSize ?? team.quizzers.length;
  return team.quizzers.map((_, index) => index).filter(index => index < count);
}

function emptyQuizzer(): QuizzerSummary { return { correct: 0, errors: 0, fouls: 0, score: 0, eligible: true, quizOut: false }; }
function summarizeTeam(session: LiveSession, side: TeamSide, profile: DivisionProfile): TeamSummary {
  const team = session[side];
  const quizzers = team.quizzers.map(() => emptyQuizzer());
  let score = profile.teamBonus;
  let standardTimeoutsUsed = 0; let substitutionTimeoutsUsed = 0; let withdrawnContests = 0; let deniedContests = 0;
  for (const event of session.events) {
    if (event.side !== side) continue;
    const quizzer = event.quizzer === undefined ? undefined : quizzers[event.quizzer];
    if (event.kind === 'correct' && quizzer) { quizzer.correct += 1; const value = questionValue(profile, event.question); quizzer.score += value; score += value; if (quizzer.correct === profile.quizOut) { quizzer.quizOut = true; quizzer.score += profile.quizzerBonus; score += profile.quizzerBonus; } }
    if (event.kind === 'error' && quizzer) { quizzer.errors += 1; const penalty = Math.floor(questionValue(profile, event.question) / 2); quizzer.score -= penalty; score -= penalty; }
    if (event.kind === 'foul' && quizzer) { quizzer.fouls += 1; quizzer.score -= profile.foulPenalty; score -= profile.foulPenalty; }
    if (event.kind === 'team-foul') score -= profile.foulPenalty;
    if (event.kind === 'timeout') { if (event.timeout === 'substitution') substitutionTimeoutsUsed += 1; else standardTimeoutsUsed += 1; }
    if (event.kind === 'contest' && event.contest === 'withdrawn') withdrawnContests += 1;
    if (event.kind === 'contest' && event.contest === 'denied') deniedContests += 1;
  }
  for (const quizzer of quizzers) quizzer.eligible = quizzer.correct < profile.quizOut && quizzer.errors < profile.maxErrors && quizzer.fouls < profile.maxFouls;
  const standardTimeoutLimit = 2 + (session.overtimeStarted ? 1 : 0);
  const effectiveDenied = deniedContests + Math.max(0, withdrawnContests - 2);
  return { score, bonus: profile.teamBonus, quizzers, standardTimeoutsUsed, standardTimeoutsRemaining: Math.max(0, standardTimeoutLimit - standardTimeoutsUsed), substitutionTimeoutsUsed, substitutionTimeoutsRemaining: Math.max(0, 1 - substitutionTimeoutsUsed), withdrawnContests, deniedContests: effectiveDenied, withdrawnContestsRemaining: Math.max(0, 4 - withdrawnContests), deniedContestsRemaining: Math.max(0, 2 - effectiveDenied), contestEligible: withdrawnContests < 4 && effectiveDenied < 2 };
}

export function summarizeSession(session: LiveSession): LiveSummary {
  const profile = profileForDivision(session.division);
  const hasOvertime = session.overtimeStarted || session.events.some(event => event.question > profile.regulationQuestions);
  const baseQuestionCount = profile.values.length + profile.continuationValues.length;
  const questionCount = hasOvertime ? Math.max(baseQuestionCount, session.currentQuestion + 1) : baseQuestionCount;
  const questionValues = Array.from({ length: questionCount }, (_, i) => questionValue(profile, i + 1));
  const red = summarizeTeam(session, 'red', profile); const yellow = summarizeTeam(session, 'yellow', profile);
  const remaining = questionValues.slice(session.currentQuestion - 1).reduce((total, value) => total + value, 0);
  const locked = Math.abs(red.score - yellow.score) > remaining;
  return { red, yellow, questionValues, locked, lockReason: locked ? `${red.score > yellow.score ? session.red.name : session.yellow.name} leads beyond the remaining available points` : undefined };
}

export function remainingPoints(summary: LiveSummary, currentQuestion: number): number {
  return summary.questionValues.slice(currentQuestion - 1).reduce((total, value) => total + value, 0);
}

export function questionsUntilLock(summary: LiveSummary, currentQuestion: number, side: TeamSide): number | null {
  const own = summary[side].score;
  const other = summary[side === 'red' ? 'yellow' : 'red'].score;
  if (own <= other) return null;
  let available = remainingPoints(summary, currentQuestion);
  if (own > other + available) return 0;
  for (let index = currentQuestion - 1; index < summary.questionValues.length; index += 1) {
    available -= summary.questionValues[index];
    if (own > other + available) return index - currentQuestion + 2;
  }
  return null;
}

export function currentContest(session: LiveSession, side: TeamSide): ContestResult | null {
  const responseIndex = session.events.reduce((latest, event, index) => event.question === session.currentQuestion && (event.kind === 'correct' || event.kind === 'error' || event.kind === 'no-response') ? index : latest, -1);
  const contest = [...session.events].map((event, index) => ({ event, index })).reverse().find(item => item.event.question === session.currentQuestion && item.event.side === side && item.event.kind === 'contest' && item.index > responseIndex)?.event;
  return contest?.contest ?? null;
}

export function addScoreEvent(session: LiveSession, event: Omit<ScoreEvent, 'id' | 'createdAt'>): LiveSession {
  const now = new Date().toISOString();
  const responseEvent = event.kind === 'correct' || event.kind === 'error' || event.kind === 'no-response';
  const retained = responseEvent ? session.events.filter(existing => existing.question !== event.question || (existing.kind !== 'correct' && existing.kind !== 'error' && existing.kind !== 'no-response')) : session.events;
  let next: LiveSession = { ...session, events: [...retained, { ...event, id: `${now}-${retained.length}`, createdAt: now }], updatedAt: now };
  if (responseEvent) {
    const profile = profileForDivision(next.division);
    const regulationComplete = next.events.some(item => item.question === profile.regulationQuestions && (item.kind === 'correct' || item.kind === 'error' || item.kind === 'no-response'));
    if (!regulationComplete) {
      next = { ...next, overtimeStarted: false, quizEnded: false };
    } else {
      const regulationOnly = { ...next, events: next.events.filter(item => item.question <= profile.regulationQuestions) };
      const regulationSummary = summarizeSession(regulationOnly);
      const tied = regulationSummary.red.score === regulationSummary.yellow.score;
      next = { ...next, events: tied ? next.events : next.events.filter(item => item.question <= profile.regulationQuestions), overtimeStarted: tied && profile.continuationValues.length > 0, quizEnded: !tied };
    }
  }
  return next;
}

export function setCurrentQuestion(session: LiveSession, question: number): LiveSession {
  return { ...session, currentQuestion: Math.max(1, Math.min(question, summarizeSession(session).questionValues.length)), updatedAt: new Date().toISOString() };
}

export function resetQuestion(session: LiveSession): LiveSession {
  return { ...session, events: session.events.filter(event => event.question !== session.currentQuestion), pendingSubstitution: undefined, updatedAt: new Date().toISOString() };
}
