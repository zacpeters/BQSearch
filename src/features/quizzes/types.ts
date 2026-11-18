import type { NormalizedScriptureReference, ScriptureReference } from '../../integration/contracts';

export interface QuizSourceLocation { documentId: string; page: number; rawPageLabel?: string; publisher?: string; collection?: string; }
export interface QuizQuestion { id: string; collectionId?: string; quizNumber: number; originalNumber: number; pointValue: 10 | 20 | 30; classification?: string; rawQuestion: string; rawAnswer: string; answerParts?: string[]; references: ScriptureReference[]; source: QuizSourceLocation; textRevision: string; uncertain?: boolean; }
export interface QuizCollection { id: string; publisher: string; name: string; sourceFilename: string; quizIds: string[]; year?: number; division?: string; description?: string; bundled?: boolean; }
export interface PublishedQuiz { id: string; collectionId: string; quizNumber: number; title: string; edition: string; questionIds: string[]; sections: { pointValue: number; startQuestion: number; endQuestion: number }[]; }
export interface QuizCatalog { schemaVersion: number; sourceSet: { id: string; title: string; edition: string; status: string }; collections: QuizCollection[]; quizzes: PublishedQuiz[]; questions: QuizQuestion[]; catalogId: string; catalogVersion: string; installedAt: string; }
export interface UserQuestion extends QuizQuestion { collectionId: string; }
export interface UserCollection extends QuizCollection { bundled: false; }
export type QuizReference = NormalizedScriptureReference;
