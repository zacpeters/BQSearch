import type { Division, ScripturePack } from '../types';

export interface ReferenceSpec {
  raw: string;
  book: string;
  chapter: number;
  verse: number;
  endVerse?: number;
  divisions: Division[];
  studyNumbers: Partial<Record<Division, number>>;
  studyNumbersByReference?: Record<string, Partial<Record<Division, number>>>;
  sourceLine: number;
}
export interface ImportIssue { kind: 'invalid-reference' | 'duplicate-reference' | 'missing-verse' | 'retrieval-error' | 'input-error'; message: string; line?: number; reference?: string; division?: Division; }
export interface ImportedReference extends ReferenceSpec { canonicalReference: string; text?: string; source: 'corpus' | 'api' | 'cache' | 'manual'; }
export interface ImportReview { references: ImportedReference[]; issues: ImportIssue[]; }
export interface KJVCorpus { get(reference: string): string | undefined; checksum?: string; sourceName?: string; sourceUrl?: string; license?: string; }
export interface PackDraft { id: string; title: string; version: string; seasonId: string; seasonName: string; year: number; references: ImportedReference[]; source: { name: string; url?: string; license: string; retrievedAt: string; corpusChecksum?: string; notes?: string }; }
export interface PackValidation { valid: boolean; errors: ImportIssue[]; warnings: ImportIssue[]; pack?: ScripturePack; }
