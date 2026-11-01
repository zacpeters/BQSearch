export type SchemaVersion = '1.0';
// New material uses four canonical divisions. Juniors/Seniors remain accepted for legacy packs.
export type Division = 'Beginner' | 'Junior' | 'Intermediate' | 'Experienced' | 'Juniors' | 'Seniors';
export interface Season { id: string; name: string; year: number; schemaVersion: SchemaVersion; }
export interface ScriptureVerse { id: string; book: string; chapter: number; verse: number; text: string; studyNumber: number; studyNumbers?: Partial<Record<Division, number>>; divisions: Division[]; }
export interface PackSourceMetadata { name: string; url?: string; license: string; retrievedAt: string; corpusChecksum?: string; notes?: string; }
export interface ScripturePack { id: string; schemaVersion: SchemaVersion; season: Season; title: string; version: string; status: 'demo' | 'draft' | 'approved' | 'published'; verses: ScriptureVerse[]; source?: PackSourceMetadata; integrityChecksum?: string; publishedAt?: string; }
export interface TournamentSettings { seasonId: string; division: Division; studyStart: number; studyEnd: number; installedPackId: string; }
export type SearchKind = 'reference' | 'word' | 'phrase' | 'verse-start' | 'study-number' | 'all';
export interface SearchQuery { raw: string; kind: SearchKind; normalized: string; }
export interface SearchResult { verse: ScriptureVerse; match: SearchKind; excerpt: string; }
