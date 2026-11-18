import type { Division, PackSourceMetadata, ScripturePack, ScriptureVerse } from '../types';

export interface ScriptureReference {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse?: number;
  id?: string;
}

export interface NormalizedScriptureReference extends ScriptureReference {
  book: string;
  endVerse?: number;
}

export interface ScripturePackIdentity {
  id: string;
  version: string;
  schemaVersion: ScripturePack['schemaVersion'];
  seasonId: string;
  source?: PackSourceMetadata;
}

export interface ResolvedScriptureVerse {
  verse: ScriptureVerse;
  canonicalOrder: number;
  studyNumber: number;
}

export type ScriptureUnavailableReason =
  | 'invalid-reference'
  | 'missing-verse'
  | 'outside-division'
  | 'outside-study-range';

export interface ScriptureLookupResult {
  reference: NormalizedScriptureReference;
  available: boolean;
  text?: string;
  verses: ResolvedScriptureVerse[];
  pack: ScripturePackIdentity;
  reason?: ScriptureUnavailableReason;
}

export interface ScriptureProviderContext {
  division: Division;
  studyStart?: number;
  studyEnd?: number;
}

export interface ScriptureProvider {
  getVerse(reference: ScriptureReference): Promise<ScriptureLookupResult>;
  getVerses(references: ScriptureReference[]): Promise<ScriptureLookupResult[]>;
  getByStudyNumber(studyNumber: number): ScriptureLookupResult | undefined;
}

export interface QuizCollectionRecord extends Record<string, unknown> { id: string; }
export interface QuizQuestionRecord extends Record<string, unknown> { id: string; collectionId?: string; }
export interface CustomQuizRecord extends Record<string, unknown> { id: string; questionIds: string[]; }
export interface CoveragePresetRecord extends Record<string, unknown> { id: string; }
export interface PracticeSessionRecord extends Record<string, unknown> { id: string; quizId: string; }

export interface QuizDataSnapshot {
  userCollections: QuizCollectionRecord[];
  userQuestions: QuizQuestionRecord[];
  customQuizzes: CustomQuizRecord[];
  coveragePresets: CoveragePresetRecord[];
  sessions: PracticeSessionRecord[];
}

export interface MigrationManifest {
  format: 'bqsearch-bqquiz-user-data';
  formatVersion: 1;
  sourceApplication: 'bqquiz';
  sourceSchemaVersion: number;
  exportedAt: string;
  counts: Record<keyof QuizDataSnapshot, number>;
  catalogId?: string;
  catalogVersion?: string;
}

export interface QuizMigrationBundle {
  manifest: MigrationManifest;
  data: QuizDataSnapshot;
}
