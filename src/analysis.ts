import { analyzeWordFrequencies, type WordFrequency } from './frequency';
import { getDivisionStudyNumber } from './division';
import { tokenizeScripture, type ScriptureToken } from './tokenize';
import type { Division, ScripturePack, ScriptureVerse } from './types';

export const ANALYSIS_VERSION = '1.1';

export type AnnotationType = 'unique-beginning' | 'unique-ending' | 'frequency-1' | 'frequency-2' | 'frequency-3';
export type AnnotationSource = 'division-analysis';
export type BoundaryStatus = 'unique' | 'unresolved';

/** Offsets are UTF-16 code-unit positions into the original verse text. */
export interface ScriptureAnnotation {
  id: string;
  type: AnnotationType;
  verseId: string;
  division: Division;
  start: number;
  end: number;
  value: string;
  normalizedValue: string;
  source: AnnotationSource;
  analysisVersion: string;
  occurrenceReferences?: string[];
}

export interface BoundaryFinding {
  verseId: string;
  reference: string;
  studyNumber: number;
  status: BoundaryStatus;
  phrase?: string;
  normalizedPhrase?: string;
  tokenCount: number;
  start?: number;
  end?: number;
  reason?: 'empty-text' | 'identical-boundary' | 'no-unique-sequence';
}

export interface AnalysisSummary {
  versesAnalyzed: number;
  uniqueBeginningsFound: number;
  unresolvedBeginnings: number;
  uniqueEndingsFound: number;
  unresolvedEndings: number;
  frequency1Words: number;
  frequency2Words: number;
  frequency3Words: number;
  annotations: number;
}

export interface AnalysisReport {
  analysisVersion: string;
  sourcePack: { id: string; version: string; checksum?: string };
  division: Division;
  configuration: { offsetConvention: 'utf-16-code-units'; frequencyScope: 'complete-division'; boundaryScope: 'complete-division' };
  summary: AnalysisSummary;
  beginnings: BoundaryFinding[];
  endings: BoundaryFinding[];
  annotations: ScriptureAnnotation[];
  unresolved: { kind: 'unique-beginning' | 'unique-ending'; verseId: string; reference: string; reason: string }[];
  warnings: string[];
  errors: string[];
}

export interface DivisionAnalysis {
  report: AnalysisReport;
  frequencies: Map<string, WordFrequency>;
}

const referenceOf = (verse: ScriptureVerse) => `${verse.book} ${verse.chapter}:${verse.verse}`;
const orderedVerses = (verses: ScriptureVerse[]) => [...verses].sort((a, b) => (a.studyNumber - b.studyNumber) || a.book.localeCompare(b.book) || (a.chapter - b.chapter) || (a.verse - b.verse) || a.id.localeCompare(b.id));
const annotationId = (type: AnnotationType, verseId: string, division: Division, start: number, end: number, value: string) => `${type}:${division}:${verseId}:${start}-${end}:${value}`;

function boundaryKey(tokens: ScriptureToken[], fromEnd: boolean, count: number): string {
  const selected = fromEnd ? tokens.slice(-count).map(token => token.normalized).reverse() : tokens.slice(0, count).map(token => token.normalized);
  return selected.join('\u0001');
}

function analyzeBoundary(verses: ScriptureVerse[], fromEnd: boolean): BoundaryFinding[] {
  const tokenized = verses.map(verse => ({ verse, tokens: tokenizeScripture(verse.text) }));
  const counts = new Map<string, number>();
  for (const item of tokenized) for (let count = 1; count <= item.tokens.length; count += 1) {
    const key = boundaryKey(item.tokens, fromEnd, count);
    counts.set(`${count}:${key}`, (counts.get(`${count}:${key}`) ?? 0) + 1);
  }
  return tokenized.map(({ verse, tokens }) => {
    const base = { verseId: verse.id, reference: referenceOf(verse), studyNumber: verse.studyNumber, tokenCount: tokens.length };
    if (!tokens.length) return { ...base, status: 'unresolved' as const, reason: 'empty-text' as const };
    let uniqueCount: number | undefined;
    for (let count = 1; count <= tokens.length; count += 1) if (counts.get(`${count}:${boundaryKey(tokens, fromEnd, count)}`) === 1) { uniqueCount = count; break; }
    if (uniqueCount === undefined) return { ...base, status: 'unresolved' as const, reason: 'no-unique-sequence' as const };
    const selected = fromEnd ? tokens.slice(-uniqueCount) : tokens.slice(0, uniqueCount);
    const start = fromEnd ? selected[0].start : selected[0].start;
    const end = fromEnd ? selected[selected.length - 1].end : selected[selected.length - 1].end;
    return { ...base, status: 'unique' as const, phrase: verse.text.slice(start, end), normalizedPhrase: selected.map(token => token.normalized).join(' '), start, end };
  });
}

function addBoundaryAnnotation(annotations: ScriptureAnnotation[], finding: BoundaryFinding, division: Division, type: 'unique-beginning' | 'unique-ending') {
  if (finding.status !== 'unique' || finding.start === undefined || finding.end === undefined || !finding.phrase) return;
  annotations.push({ id: annotationId(type, finding.verseId, division, finding.start, finding.end, finding.phrase), type, verseId: finding.verseId, division, start: finding.start, end: finding.end, value: finding.phrase, normalizedValue: finding.normalizedPhrase ?? finding.phrase.toLocaleLowerCase(), source: 'division-analysis', analysisVersion: ANALYSIS_VERSION });
}

function addFrequencyAnnotations(annotations: ScriptureAnnotation[], verses: ScriptureVerse[], division: Division, frequencies: Map<string, WordFrequency>) {
  for (const verse of orderedVerses(verses)) {
    const reference = referenceOf(verse);
    for (const token of tokenizeScripture(verse.text)) {
      const frequency = frequencies.get(token.normalized);
      if (!frequency || frequency.totalOccurrences > 3) continue;
      const type = `frequency-${frequency.totalOccurrences}` as AnnotationType;
      annotations.push({ id: annotationId(type, verse.id, division, token.start, token.end, token.normalized), type, verseId: verse.id, division, start: token.start, end: token.end, value: token.text, normalizedValue: token.normalized, source: 'division-analysis', analysisVersion: ANALYSIS_VERSION, occurrenceReferences: frequency.references.map(item => item.reference) });
    }
  }
}

export function analyzeScriptureDivision(verses: ScriptureVerse[], division: Division, sourcePack?: Pick<ScripturePack, 'id' | 'version' | 'integrityChecksum'>): DivisionAnalysis {
  const projected = orderedVerses(verses.filter(verse => getDivisionStudyNumber(verse, division) !== null).map(verse => ({ ...verse, studyNumber: getDivisionStudyNumber(verse, division)! })));
  const beginnings = analyzeBoundary(projected, false);
  const endings = analyzeBoundary(projected, true);
  const frequencies = analyzeWordFrequencies(projected);
  const annotations: ScriptureAnnotation[] = [];
  for (const finding of beginnings) addBoundaryAnnotation(annotations, finding, division, 'unique-beginning');
  for (const finding of endings) addBoundaryAnnotation(annotations, finding, division, 'unique-ending');
  addFrequencyAnnotations(annotations, projected, division, frequencies);
  annotations.sort((a, b) => a.verseId.localeCompare(b.verseId) || a.start - b.start || a.end - b.end || a.type.localeCompare(b.type) || a.id.localeCompare(b.id));
  const unresolved = [...beginnings.filter(item => item.status === 'unresolved').map(item => ({ kind: 'unique-beginning' as const, verseId: item.verseId, reference: item.reference, reason: item.reason ?? 'unresolved' })), ...endings.filter(item => item.status === 'unresolved').map(item => ({ kind: 'unique-ending' as const, verseId: item.verseId, reference: item.reference, reason: item.reason ?? 'unresolved' }))];
  const summary: AnalysisSummary = { versesAnalyzed: projected.length, uniqueBeginningsFound: beginnings.filter(item => item.status === 'unique').length, unresolvedBeginnings: beginnings.filter(item => item.status === 'unresolved').length, uniqueEndingsFound: endings.filter(item => item.status === 'unique').length, unresolvedEndings: endings.filter(item => item.status === 'unresolved').length, frequency1Words: [...frequencies.values()].filter(item => item.totalOccurrences === 1).length, frequency2Words: [...frequencies.values()].filter(item => item.totalOccurrences === 2).length, frequency3Words: [...frequencies.values()].filter(item => item.totalOccurrences === 3).length, annotations: annotations.length };
  const report: AnalysisReport = { analysisVersion: ANALYSIS_VERSION, sourcePack: { id: sourcePack?.id ?? 'unidentified-pack', version: sourcePack?.version ?? 'unknown', ...(sourcePack?.integrityChecksum ? { checksum: sourcePack.integrityChecksum } : {}) }, division, configuration: { offsetConvention: 'utf-16-code-units', frequencyScope: 'complete-division', boundaryScope: 'complete-division' }, summary, beginnings, endings, annotations, unresolved, warnings: [], errors: validateAnalysisReport({ analysisVersion: ANALYSIS_VERSION, sourcePack: { id: sourcePack?.id ?? 'unidentified-pack', version: sourcePack?.version ?? 'unknown' }, division, configuration: { offsetConvention: 'utf-16-code-units', frequencyScope: 'complete-division', boundaryScope: 'complete-division' }, summary, beginnings, endings, annotations, unresolved, warnings: [], errors: [] }) };
  return { report, frequencies };
}

export function validateAnalysisReport(report: AnalysisReport, verses: ScriptureVerse[] = []): string[] {
  const errors: string[] = []; const ids = new Set(verses.map(verse => verse.id)); const annotationIds = new Set<string>();
  for (const annotation of report.annotations) {
    if (annotationIds.has(annotation.id)) errors.push(`Duplicate annotation identifier: ${annotation.id}.`); annotationIds.add(annotation.id);
    const verse = verses.find(item => item.id === annotation.verseId);
    if (annotation.start < 0 || annotation.end > (verse?.text.length ?? annotation.end) || annotation.start >= annotation.end) errors.push(`Invalid annotation offsets: ${annotation.id}.`);
    if (verse && annotation.start >= 0 && annotation.end <= verse.text.length && annotation.value !== verse.text.slice(annotation.start, annotation.end)) errors.push(`${referenceOf(verse)} ${annotation.type}: annotation value mismatch for offsets ${annotation.start}-${annotation.end}; expected ${JSON.stringify(verse.text.slice(annotation.start, annotation.end))}, actual ${JSON.stringify(annotation.value)}.`);
    if (verses.length && !ids.has(annotation.verseId)) errors.push(`Annotation references missing verse: ${annotation.verseId}.`);
    if (verse && (!verse.divisions.includes(annotation.division) || getDivisionStudyNumber(verse, annotation.division) === null)) errors.push(`Annotation has an invalid division mapping: ${annotation.id}.`);
  }
  return errors;
}

export function analysisJson(report: AnalysisReport): string { return JSON.stringify(report, null, 2); }
