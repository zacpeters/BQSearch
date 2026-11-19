import { getDivisionStudyNumber, projectVersesForDivision } from '../../division';
import { normalizeScriptureReference } from '../../integration/scripture-provider';
import type { Division, ScripturePack } from '../../types';
import { classificationKey } from './generator/classifications';
import type { GeneratedQuiz, GenerationFilters, QuizQuestion, StudyOption } from './types';

export const DEFAULT_POINT_COUNTS = { 10: 8, 20: 9, 30: 3 } as const;
export const POINT_VALUES = [10, 20, 30] as const;
export type PointCounts = GenerationFilters['pointCounts'];

export function studyOptions(pack: ScripturePack, division: Division): StudyOption[] {
  return projectVersesForDivision(pack.verses, division)
    .map(verse => ({ studyNumber: getDivisionStudyNumber(verse, division)!, reference: { book: verse.book, chapter: verse.chapter, startVerse: verse.verse }, verseId: verse.id }))
    .sort((a, b) => a.studyNumber - b.studyNumber || a.verseId.localeCompare(b.verseId));
}

const verseKey = (book: string, chapter: number, verse: number) => `${book}|${chapter}|${verse}`;

export function questionPublisher(question: QuizQuestion, collectionPublishers?: ReadonlyMap<string, string>) {
  return question.source?.publisher?.trim() || collectionPublishers?.get(question.collectionId ?? '')?.trim() || 'Unspecified';
}

export function analyzeQuestionPool(questions: QuizQuestion[], filters: GenerationFilters, pack: ScripturePack, collectionPublishers?: ReadonlyMap<string, string>) {
  const collections = new Set(filters.collectionIds);
  const publishers = new Set(filters.publisherIds);
  const types = new Set(filters.classifications.map(classificationKey));
  const explicit = filters.selectionMode === 'explicit';
  const range = filters.restrictCoverage ? filters.coverage : undefined;
  const studyNumbers = new Map<string, number>();
  if (range) for (const option of studyOptions(pack, filters.division as Division)) {
    const ref = option.reference;
    studyNumbers.set(verseKey(ref.book, ref.chapter, ref.startVerse), option.studyNumber);
  }
  const pool: QuizQuestion[] = [];
  const counts: PointCounts = { 10: 0, 20: 0, 30: 0 };
  const diagnostics = { noStructuredReference: 0, unavailableReferences: 0 };
  for (const question of questions) {
    if (!collections.has(question.collectionId ?? '')) continue;
    if ((explicit || publishers.size) && !publishers.has(questionPublisher(question, collectionPublishers))) continue;
    if ((explicit || types.size) && !types.has(classificationKey(question.classification))) continue;
    if (range) {
      if (!question.references.length) {
        diagnostics.noStructuredReference++;
        continue;
      }
      let unavailable = false;
      let outside = false;
      for (const ref of question.references) {
        try {
          const normalized = normalizeScriptureReference(ref);
          for (let verse = normalized.startVerse; verse <= (normalized.endVerse ?? normalized.startVerse); verse++) {
            const number = studyNumbers.get(verseKey(normalized.book, normalized.chapter, verse));
            if (number === undefined) {
              unavailable = true;
              break;
            }
            if (number < range.startStudyNumber || number > range.endStudyNumber) outside = true;
          }
        } catch {
          unavailable = true;
        }
        if (unavailable) break;
      }
      if (unavailable) diagnostics.unavailableReferences++;
      if (unavailable || outside) continue;
    } else if (explicit && filters.restrictCoverage) {
      continue;
    }
    pool.push(question);
    counts[question.pointValue]++;
  }
  return { pool, counts, diagnostics };
}

export function eligibleQuestions(questions: QuizQuestion[], filters: GenerationFilters, pack: ScripturePack) {
  return analyzeQuestionPool(questions, filters, pack).pool;
}

export function poolCounts(questions: QuizQuestion[], filters: GenerationFilters, pack: ScripturePack) {
  return analyzeQuestionPool(questions, filters, pack).counts;
}

export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

// V5 encounters chapters in shuffled pool order, then draws one item per bucket.
function balancedPick(pool: QuizQuestion[], count: number, random: () => number) {
  if (count === 0) return [];
  const groups = new Map<number, QuizQuestion[]>();
  for (const question of shuffle(pool, random)) {
    const chapter = question.references[0]?.chapter ?? -1;
    const group = groups.get(chapter);
    if (group) group.push(question);
    else groups.set(chapter, [question]);
  }
  const buckets = [...groups.values()].map(group => shuffle(group, random));
  const picked: QuizQuestion[] = [];
  for (let index = 0; picked.length < count; index++) {
    for (const bucket of buckets) {
      if (bucket[index] && picked.length < count) picked.push(bucket[index]);
    }
  }
  return picked;
}

export function generateFromPool(availability: ReturnType<typeof analyzeQuestionPool>, filters: GenerationFilters, seed: number) {
  const { pool, counts } = availability;
  const requested = POINT_VALUES.map(point => filters.pointCounts[point]);
  if (requested.some(count => !Number.isSafeInteger(count) || count < 0)) throw new Error('Enter whole, non-negative question counts.');
  if (!requested.some(count => count > 0)) throw new Error('Choose at least one question.');
  for (const point of POINT_VALUES) {
    if (counts[point] < filters.pointCounts[point]) throw new Error(`Only ${counts[point]} eligible ${point}-point questions are available; ${filters.pointCounts[point]} required.`);
  }
  const random = seededRandom(seed);
  return POINT_VALUES.flatMap(point => {
    const candidates = pool.filter(question => question.pointValue === point);
    return filters.strategy === 'balanced'
      ? balancedPick(candidates, filters.pointCounts[point], random)
      : shuffle(candidates, random).slice(0, filters.pointCounts[point]);
  });
}

export function generateSelection(questions: QuizQuestion[], filters: GenerationFilters, pack: ScripturePack, seed: number) {
  const availability = analyzeQuestionPool(questions, filters, pack);
  return { ...availability, selected: generateFromPool(availability, filters, seed) };
}

export const randomSeed = () => Math.floor(Math.random() * 0xffffffff);

export function generatedQuizFromSelection(title: string, selected: QuizQuestion[], seed: number, filters: GenerationFilters, catalogId: string, catalogVersion: string): GeneratedQuiz {
  const now = new Date().toISOString();
  return {
    id: `custom-${crypto.randomUUID()}`, title: title.trim() || 'Generated quiz', createdAt: now, updatedAt: now,
    questionIds: selected.map(question => question.id), seed, filters,
    totalPoints: selected.reduce((sum, question) => sum + question.pointValue, 0),
    catalogId, catalogVersion,
  };
}
