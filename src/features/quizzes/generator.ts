import { getDivisionStudyNumber, projectVersesForDivision } from '../../division';
import { normalizeScriptureReference } from '../../integration/scripture-provider';
import type { ScripturePack } from '../../types';
import type { GeneratedQuiz, GenerationFilters, QuizQuestion, StudyOption } from './types';

export const DEFAULT_POINT_COUNTS = { 10: 8, 20: 9, 30: 3 } as const;
export const POINT_VALUES = [10, 20, 30] as const;
export function classificationKey(value?: string) { return (value || 'Direct').toLowerCase().replace(/[^a-z0-9]/g, '') || 'direct'; }
export function classificationLabel(value?: string) { return value?.trim() || 'Direct'; }

export function studyOptions(pack: ScripturePack, division: Parameters<typeof projectVersesForDivision>[1]): StudyOption[] {
  return projectVersesForDivision(pack.verses, division).map(verse => ({ studyNumber: getDivisionStudyNumber(verse, division)!, reference: { book: verse.book, chapter: verse.chapter, startVerse: verse.verse }, verseId: verse.id })).sort((a, b) => a.studyNumber - b.studyNumber || a.verseId.localeCompare(b.verseId));
}

function verseNumbers(reference: QuizQuestion['references'][number]) {
  const normalized = normalizeScriptureReference(reference); const end = normalized.endVerse ?? normalized.startVerse;
  return Array.from({ length: end - normalized.startVerse + 1 }, (_, index) => ({ book: normalized.book, chapter: normalized.chapter, startVerse: normalized.startVerse + index }));
}

function questionStudyNumbers(question: QuizQuestion, pack: ScripturePack, division: Parameters<typeof projectVersesForDivision>[1]) {
  const numbers: number[] = [];
  for (const reference of question.references) for (const verseRef of verseNumbers(reference)) {
    const verse = pack.verses.find(item => item.book === verseRef.book && item.chapter === verseRef.chapter && item.verse === verseRef.startVerse);
    if (!verse) return undefined;
    const studyNumber = getDivisionStudyNumber(verse, division); if (studyNumber === null) return undefined; numbers.push(studyNumber);
  }
  return numbers;
}

export function questionIsEligible(question: QuizQuestion, filters: GenerationFilters, pack: ScripturePack) {
  if (!filters.collectionIds.includes(question.collectionId ?? '')) return false;
  if (filters.publisherIds.length && !filters.publisherIds.includes(question.source.publisher ?? '')) return false;
  if (filters.classifications.length && !filters.classifications.some(type => classificationKey(question.classification) === classificationKey(type) || classificationKey(question.classification).includes(classificationKey(type)) || classificationKey(type).includes(classificationKey(question.classification)))) return false;
  if (!filters.restrictCoverage || !filters.coverage) return true;
  if (!question.references.length) return false;
  const numbers = questionStudyNumbers(question, pack, filters.division as Parameters<typeof projectVersesForDivision>[1]);
  return Boolean(numbers?.length && numbers.every(number => number >= filters.coverage!.startStudyNumber && number <= filters.coverage!.endStudyNumber));
}

export function eligibleQuestions(questions: QuizQuestion[], filters: GenerationFilters, pack: ScripturePack) { return questions.filter(question => questionIsEligible(question, filters, pack)); }
export function poolCounts(questions: QuizQuestion[], filters: GenerationFilters, pack: ScripturePack) { const pool = eligibleQuestions(questions, filters, pack); return { 10: pool.filter(q => q.pointValue === 10).length, 20: pool.filter(q => q.pointValue === 20).length, 30: pool.filter(q => q.pointValue === 30).length }; }
export function exclusionDiagnostics(questions: QuizQuestion[], filters: GenerationFilters, pack: ScripturePack) { const eligible = new Set(eligibleQuestions(questions, filters, pack).map(q => q.id)); return { noStructuredReference: filters.restrictCoverage && Boolean(filters.coverage) ? questions.filter(q => !q.references.length && !eligible.has(q.id)).length : 0, unavailableReferences: filters.restrictCoverage && Boolean(filters.coverage) ? questions.filter(q => q.references.length && !eligible.has(q.id) && !questionStudyNumbers(q, pack, filters.division as Parameters<typeof projectVersesForDivision>[1])).length : 0 }; }
export function seededRandom(seed: number) { let state = seed >>> 0; return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; }; }
function shuffle<T>(items: T[], random: () => number) { const result = [...items]; for (let index = result.length - 1; index > 0; index -= 1) { const swap = Math.floor(random() * (index + 1)); [result[index], result[swap]] = [result[swap], result[index]]; } return result; }
function balancedPick(pool: QuizQuestion[], count: number, random: () => number) { const groups = new Map<number, QuizQuestion[]>(); shuffle([...pool].sort((a, b) => a.id.localeCompare(b.id)), random).forEach(question => { const chapter = question.references[0]?.chapter ?? -1; groups.set(chapter, [...(groups.get(chapter) ?? []), question]); }); const buckets = [...groups.entries()].sort(([a], [b]) => a - b).map(([, items]) => shuffle(items, random)); const picked: QuizQuestion[] = []; while (picked.length < count && buckets.some(bucket => bucket.length)) for (const bucket of buckets) if (bucket.length && picked.length < count) picked.push(bucket.shift()!); return picked; }
export function generateSelection(questions: QuizQuestion[], filters: GenerationFilters, pack: ScripturePack, seed: number) { const pool = eligibleQuestions(questions, filters, pack); const counts = poolCounts(questions, filters, pack); for (const point of POINT_VALUES) if (counts[point] < filters.pointCounts[point]) throw new Error(`Only ${counts[point]} eligible ${point}-point questions are available; ${filters.pointCounts[point]} required.`); const random = seededRandom(seed); const selected = POINT_VALUES.flatMap(point => { const candidates = pool.filter(question => question.pointValue === point); return filters.strategy === 'balanced' ? balancedPick(candidates, filters.pointCounts[point], random) : shuffle([...candidates].sort((a, b) => a.id.localeCompare(b.id)), random).slice(0, filters.pointCounts[point]); }); return { selected, pool, counts }; }
export function randomSeed() { return Math.floor(Math.random() * 0xffffffff); }
export function generatedQuizFromSelection(title: string, selected: QuizQuestion[], seed: number, filters: GenerationFilters, catalogId: string, catalogVersion: string): GeneratedQuiz { const now = new Date().toISOString(); return { id: `custom-${crypto.randomUUID()}`, title: title.trim() || 'Generated quiz', createdAt: now, updatedAt: now, questionIds: selected.map(question => question.id), seed, filters, totalPoints: selected.reduce((sum, question) => sum + question.pointValue, 0), catalogId, catalogVersion }; }
