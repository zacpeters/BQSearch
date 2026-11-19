import { normalizeScriptureReference } from '../../../integration/scripture-provider';
import type { ScriptureReference } from '../../../integration/contracts';
import type { UserCollection, UserQuestion } from '../types';
import { parseQuestionReferences } from '../v5-format';

export interface ImportReport {
  collections: UserCollection[];
  questions: UserQuestion[];
  errors: string[];
  warnings: string[];
  duplicateIds: string[];
}

const emptyReport = (): ImportReport => ({ collections: [], questions: [], errors: [], warnings: [], duplicateIds: [] });
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const hasText = (value: unknown): value is string => typeof value === 'string' && Boolean(value.trim());
const validPoint = (value: unknown) => [10, 20, 30].includes(Number(value));

function parseReferences(value: unknown, report: ImportReport, questionId: string): ScriptureReference[] {
  if (!value) return [];
  const references = typeof value === 'string' ? value.split(/[;,]/).map(ref => ref.trim()).filter(Boolean) : value;
  if (!Array.isArray(references)) {
    report.warnings.push(`Question ${questionId} contains invalid Scripture references.`);
    return [];
  }
  return references.flatMap(reference => {
    try {
      return typeof reference === 'string' ? parseQuestionReferences(reference) : [normalizeScriptureReference(reference)];
    } catch {
      report.warnings.push(`Question ${questionId} contains an invalid Scripture reference.`);
      return [];
    }
  });
}

function recordDuplicates(report: ImportReport) {
  const duplicates = new Set<string>();
  for (const rows of [report.collections, report.questions]) {
    const seen = new Set<string>();
    for (const row of rows) {
      if (seen.has(row.id)) duplicates.add(row.id);
      seen.add(row.id);
    }
  }
  report.duplicateIds = [...duplicates];
  return report;
}

export function parseJsonImport(value: unknown): ImportReport {
  const report = emptyReport();
  if (!isRecord(value)) {
    report.errors.push('Import must be a JSON object.');
    return report;
  }
  if (value.schemaVersion === 2 && isRecord(value.sourceSet)) {
    report.errors.push('Install published catalogs from Advanced catalog options.');
    return report;
  }
  const source = isRecord(value.data) ? value.data : value;
  if ([source.sessions, source.customQuizzes, source.coveragePresets].some(rows => Array.isArray(rows) && rows.length > 0)) {
    report.warnings.push('This import only transfers user collections and questions. Saved quizzes, presets, and practice sessions require a separate restore.');
  }
  const collections = source.collections ?? source.userCollections ?? [];
  const questions = source.questions ?? source.userQuestions ?? [];
  if (!Array.isArray(collections) || !Array.isArray(questions) || (!collections.length && !questions.length)) {
    report.errors.push('Import must contain a collections or questions array with records.');
    return report;
  }
  for (const [index, value] of collections.entries()) {
    if (!isRecord(value) || !hasText(value.id) || !hasText(value.name)) {
      report.errors.push(`Collection ${index + 1} is malformed.`);
      continue;
    }
    report.collections.push({
      ...(value as unknown as UserCollection),
      publisher: hasText(value.publisher) ? value.publisher : 'Imported',
      sourceFilename: hasText(value.sourceFilename) ? value.sourceFilename : 'user-import',
      quizIds: Array.isArray(value.quizIds) ? value.quizIds : [],
      bundled: false,
    });
  }
  const byId = new Map(report.collections.map(collection => [collection.id, collection]));
  for (const [index, value] of questions.entries()) {
    if (!isRecord(value) || !hasText(value.id) || !hasText(value.collectionId) || !hasText(value.rawQuestion) || !hasText(value.rawAnswer) || !validPoint(value.pointValue)) {
      report.errors.push(`Question ${index + 1} is missing required fields or has an invalid point value.`);
      continue;
    }
    const collection = byId.get(value.collectionId);
    report.questions.push({
      ...(value as unknown as UserQuestion),
      quizNumber: Number(value.quizNumber) || 0,
      originalNumber: Number(value.originalNumber) || index + 1,
      pointValue: Number(value.pointValue) as UserQuestion['pointValue'],
      references: parseReferences(value.references, report, value.id),
      source: isRecord(value.source) ? value.source as unknown as UserQuestion['source']
        : { documentId: 'user-import', page: 0, publisher: collection?.publisher, collection: collection?.name },
      textRevision: hasText(value.textRevision) ? value.textRevision : 'user-import-v1',
    });
  }
  return recordDuplicates(report);
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += character;
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted field.');
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export function parseCsvImport(text: string): ImportReport {
  const report = emptyReport();
  let rows: string[][];
  try { rows = parseCsvRows(text); }
  catch (error) {
    report.errors.push(error instanceof Error ? error.message : 'CSV could not be parsed.');
    return report;
  }
  const headers = (rows.shift() ?? []).map(header => header.trim().toLowerCase());
  if (!headers.includes('question') || !headers.includes('answer') || !rows.length) {
    report.errors.push('CSV must include question and answer columns and at least one row.');
    return report;
  }
  const get = (row: string[], name: string) => row[headers.indexOf(name)]?.trim() ?? '';
  const collections = new Map<string, UserCollection>();
  for (const [index, row] of rows.entries()) {
    const rawQuestion = get(row, 'question');
    const rawAnswer = get(row, 'answer');
    const pointValue = Number(get(row, 'point value') || get(row, 'pointvalue'));
    if (!rawQuestion || !rawAnswer || !validPoint(pointValue)) {
      report.errors.push(`Row ${index + 2} is missing a question, answer, or valid point value.`);
      continue;
    }
    const collectionId = get(row, 'collection id') || `imported-${get(row, 'collection') || 'collection'}`;
    const publisher = get(row, 'publisher') || 'Imported';
    const name = get(row, 'collection') || collectionId;
    if (!collections.has(collectionId)) collections.set(collectionId, {
      id: collectionId, publisher, name, year: Number(get(row, 'year')) || undefined, sourceFilename: 'user-import', quizIds: [], bundled: false,
    });
    const id = get(row, 'external id') || `user-${crypto.randomUUID()}`;
    const answerParts = get(row, 'answer parts');
    report.questions.push({
      id, collectionId, quizNumber: Number(get(row, 'quiz number')) || 0, originalNumber: Number(get(row, 'question number')) || index + 1,
      pointValue: pointValue as UserQuestion['pointValue'], rawQuestion, rawAnswer,
      classification: get(row, 'classification') || undefined,
      ...(answerParts ? { answerParts: answerParts.split('|').map(part => part.trim()) } : {}),
      references: parseReferences(get(row, 'scripture references') || get(row, 'references'), report, id),
      source: { documentId: 'user-import', page: Number(get(row, 'source page')) || 0, publisher, collection: name },
      textRevision: 'user-import-v1',
    });
  }
  report.collections = [...collections.values()];
  return recordDuplicates(report);
}
