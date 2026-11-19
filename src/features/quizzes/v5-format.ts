import { normalizeScriptureReference } from '../../integration/scripture-provider';
import type { ScriptureReference } from '../../integration/contracts';
import type { QuizQuestion } from './types';

export function displayClassification(value?: string) {
  if (!value) return 'Direct';
  const compact = value.toLowerCase().replace(/[^a-z]/g, '');
  const part = compact.match(/(two|three|four|five|six)part/)?.[1];
  const partLabel = part ? `${part[0].toUpperCase()}${part.slice(1)}-Part` : '';
  const cross = compact.includes('crossreference');
  if (cross && compact.includes('quotation')) return 'Cross-Reference Quotation';
  if (cross && partLabel) return `${partLabel} · Cross-Reference`;
  if (cross) return 'Cross-Reference';
  if (compact.includes('quotationcompletion')) return 'Quotation Completion';
  if (partLabel) return partLabel;
  if (compact.includes('quotation')) return 'Quotation';
  return value.replace(/\s+/g, ' ').trim();
}

export function observedCoverage(questions: QuizQuestion[]) {
  const refs = questions.flatMap(q => q.references).filter(ref => ref.book && ref.chapter > 0)
    .sort((a, b) => a.book.localeCompare(b.book) || a.chapter - b.chapter || a.startVerse - b.startVerse);
  if (!refs.length) return 'Observed references unavailable';
  const first = refs[0];
  const last = refs[refs.length - 1];
  return `${first.book} ${first.chapter}:${first.startVerse}–${last.chapter === first.chapter ? '' : `${last.chapter}:`}${last.startVerse}`;
}

export function formatReference(ref: ScriptureReference) {
  return `${ref.book} ${ref.chapter}:${ref.startVerse}${ref.endVerse ? `–${ref.endVerse}` : ''}`;
}

export function parseQuestionReferences(value: string) {
  return value.split(';').map(ref => ref.trim()).filter(Boolean).map(ref => {
    const match = ref.match(/^(.+?)\s+(\d+):(\d+)(?:\s*[-–]\s*(\d+))?$/);
    if (!match) throw new Error(`Invalid Scripture reference: ${ref}`);
    try {
      return normalizeScriptureReference({ book: match[1], chapter: Number(match[2]), startVerse: Number(match[3]), ...(match[4] ? { endVerse: Number(match[4]) } : {}) });
    } catch {
      throw new Error(`Invalid Scripture reference: ${ref}`);
    }
  });
}

export function downloadQuizData(filename: string, data: unknown) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
