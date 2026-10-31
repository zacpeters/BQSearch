export type SchemaVersion = '1.0';
export type Division = 'Juniors' | 'Intermediate' | 'Seniors';
export interface Season { id: string; name: string; year: number; schemaVersion: SchemaVersion; }
export interface ScriptureVerse { id: string; book: string; chapter: number; verse: number; text: string; studyNumber: number; divisions: Division[]; }
export interface ScripturePack { id: string; schemaVersion: SchemaVersion; season: Season; title: string; version: string; status: 'demo' | 'published'; verses: ScriptureVerse[]; publishedAt?: string; }
export interface TournamentSettings { seasonId: string; division: Division; studyStart: number; studyEnd: number; installedPackId: string; }
export type SearchKind = 'reference' | 'word' | 'phrase' | 'verse-start' | 'study-number' | 'all';
export interface SearchQuery { raw: string; kind: SearchKind; normalized: string; }
export interface SearchResult { verse: ScriptureVerse; match: SearchKind; excerpt: string; }
