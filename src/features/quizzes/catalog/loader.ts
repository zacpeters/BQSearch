import { normalizeScriptureReference } from '../../../integration/scripture-provider';
import type { PublishedQuiz, QuizCatalog, QuizCollection, QuizQuestion } from '../types';

export const QUIZ_CATALOG_SCHEMA_VERSION = 2;
export interface CatalogValidation { valid: boolean; errors: string[]; warnings: string[]; catalog?: QuizCatalog; }
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const hasText = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
const unique = (values: string[]) => new Set(values).size === values.length;

export function validateCatalog(value: unknown): CatalogValidation {
  const errors: string[] = []; const warnings: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ['Catalog must be a JSON object.'], warnings };
  if (value.schemaVersion !== QUIZ_CATALOG_SCHEMA_VERSION) errors.push(`Unsupported catalog schema version: ${String(value.schemaVersion)}.`);
  const sourceSet = value.sourceSet;
  if (!isRecord(sourceSet) || !hasText(sourceSet.id) || !hasText(sourceSet.title) || !hasText(sourceSet.edition) || !hasText(sourceSet.status)) errors.push('Catalog sourceSet metadata is missing.');
  const collections = Array.isArray(value.collections) ? value.collections : []; const quizzes = Array.isArray(value.quizzes) ? value.quizzes : []; const questions = Array.isArray(value.questions) ? value.questions : [];
  if (!Array.isArray(value.collections)) errors.push('Catalog collections must be an array.');
  if (!Array.isArray(value.quizzes)) errors.push('Catalog quizzes must be an array.');
  if (!Array.isArray(value.questions)) errors.push('Catalog questions must be an array.');
  const collectionIds = collections.map(item => isRecord(item) ? String(item.id ?? '') : ''); const quizIds = quizzes.map(item => isRecord(item) ? String(item.id ?? '') : ''); const questionIds = questions.map(item => isRecord(item) ? String(item.id ?? '') : '');
  if (!unique(collectionIds.filter(Boolean))) errors.push('Catalog contains duplicate collection IDs.');
  if (!unique(quizIds.filter(Boolean))) errors.push('Catalog contains duplicate quiz IDs.');
  if (!unique(questionIds.filter(Boolean))) errors.push('Catalog contains duplicate question IDs.');
  const collectionSet = new Set(collectionIds); const quizSet = new Set(quizIds); const questionSet = new Set(questionIds);
  for (const [index, collection] of collections.entries()) {
    if (!isRecord(collection) || !hasText(collection.id) || !hasText(collection.name) || !hasText(collection.publisher) || !Array.isArray(collection.quizIds)) { errors.push(`Collection ${index + 1} is malformed.`); continue; }
    for (const quizId of collection.quizIds) if (!quizSet.has(String(quizId))) errors.push(`Collection ${collection.id} references missing quiz ${String(quizId)}.`);
  }
  for (const [index, quiz] of quizzes.entries()) {
    if (!isRecord(quiz) || !hasText(quiz.id) || !hasText(quiz.collectionId) || !Array.isArray(quiz.questionIds)) { errors.push(`Quiz ${index + 1} is malformed.`); continue; }
    if (!collectionSet.has(String(quiz.collectionId))) errors.push(`Quiz ${quiz.id} references missing collection ${String(quiz.collectionId)}.`);
    for (const questionId of quiz.questionIds) if (!questionSet.has(String(questionId))) errors.push(`Quiz ${quiz.id} references missing question ${String(questionId)}.`);
  }
  for (const [index, question] of questions.entries()) {
    if (!isRecord(question) || !hasText(question.id) || !hasText(question.rawQuestion) || !hasText(question.rawAnswer) || ![10, 20, 30].includes(Number(question.pointValue)) || !Array.isArray(question.references) || !isRecord(question.source)) { errors.push(`Question ${index + 1} is malformed.`); continue; }
    if (question.collectionId !== undefined && !collectionSet.has(String(question.collectionId))) errors.push(`Question ${question.id} references missing collection ${String(question.collectionId)}.`);
    if (!['10', '20', '30'].includes(String(question.pointValue))) errors.push(`Question ${question.id} has an invalid point value.`);
    for (const reference of question.references) { try { normalizeScriptureReference(reference as { book: string; chapter: number; startVerse: number; endVerse?: number }); } catch { warnings.push(`Question ${question.id} contains an invalid Scripture reference.`); } }
  }
  if (errors.length) return { valid: false, errors, warnings };
  const sourceMeta = sourceSet as QuizCatalog['sourceSet'];
  const catalog = { schemaVersion: QUIZ_CATALOG_SCHEMA_VERSION, sourceSet: sourceMeta, collections: collections as QuizCollection[], quizzes: quizzes as PublishedQuiz[], questions: questions as QuizQuestion[], catalogId: String(sourceMeta.id), catalogVersion: `${sourceMeta.edition}-schema-${value.schemaVersion}`, installedAt: new Date().toISOString() };
  return { valid: true, errors, warnings, catalog };
}

function stable(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`; if (value && typeof value === 'object') return `{${Object.keys(value as Record<string, unknown>).sort().map(key => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(',')}}`; return JSON.stringify(value); }
export async function sha256CatalogDigest(value: unknown): Promise<string> { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stable(value))); return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join(''); }
export async function verifyCatalog(value: unknown, expectedDigest?: string): Promise<CatalogValidation> {
  const result = validateCatalog(value);
  if (!result.valid || !result.catalog) return result;
  const digest = await sha256CatalogDigest(value);
  const expected = expectedDigest?.trim().toLowerCase();
  if (expected && digest !== expected) return { valid: false, errors: [`Catalog digest mismatch. Computed ${digest}; expected ${expected}.`], warnings: [] };
  return { ...result, catalog: { ...result.catalog, catalogDigest: digest } };
}
export async function readCatalogFile(file: File, expectedDigest?: string): Promise<CatalogValidation> {
  let value: unknown;
  try { value = JSON.parse(await file.text()); } catch { return { valid: false, errors: ['Catalog file is not valid JSON.'], warnings: [] }; }
  return verifyCatalog(value, expectedDigest);
}
