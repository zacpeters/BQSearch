import type { NormalizedScriptureReference, ScriptureReference } from '../../integration/contracts';

export interface QuizSourceLocation { documentId: string; page: number; rawPageLabel?: string; publisher?: string; collection?: string; }
export interface QuizQuestion { id: string; collectionId?: string; quizNumber: number; originalNumber: number; pointValue: 10 | 20 | 30; classification?: string; rawQuestion: string; rawAnswer: string; answerParts?: string[]; references: ScriptureReference[]; source: QuizSourceLocation; textRevision: string; uncertain?: boolean; }
export interface QuizCollection { id: string; publisher: string; name: string; sourceFilename: string; quizIds: string[]; year?: number; division?: string; description?: string; bundled?: boolean; }
export interface PublishedQuiz { id: string; collectionId: string; quizNumber: number; title: string; edition: string; questionIds: string[]; sections: { pointValue: number; startQuestion: number; endQuestion: number }[]; }
export interface QuizCatalog { schemaVersion: number; sourceSet: { id: string; title: string; edition: string; status: string }; collections: QuizCollection[]; quizzes: PublishedQuiz[]; questions: QuizQuestion[]; catalogId: string; catalogVersion: string; catalogDigest?: string; installedAt: string; }
export interface UserQuestion extends QuizQuestion { collectionId: string; }
export interface UserCollection extends QuizCollection { bundled: false; }
export type QuizReference = NormalizedScriptureReference;
export type GenerationStrategy = 'balanced' | 'random';
export interface CoverageSelection { start: QuizReference; end: QuizReference; startStudyNumber: number; endStudyNumber: number; }
export interface GenerationFilters { collectionIds: string[]; publisherIds: string[]; pointCounts: { 10: number; 20: number; 30: number }; classifications: string[]; coverage?: CoverageSelection; restrictCoverage: boolean; strategy: GenerationStrategy; seasonId: string; division: string; packId: string; }
export interface GeneratedQuiz { id: string; title: string; createdAt: string; updatedAt: string; questionIds: string[]; seed: number; filters: GenerationFilters; totalPoints: number; catalogId: string; catalogVersion: string; }
export interface CoveragePreset { id: string; name: string; range: CoverageSelection; seasonId: string; division: string; packId: string; catalogId: string; updatedAt: string; }
export interface StudyOption { studyNumber: number; reference: QuizReference; verseId: string; }
export interface QuizPracticeSession { id: string; quizId: string; updatedAt: string; }
