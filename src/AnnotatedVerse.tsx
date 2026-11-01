import { useEffect, type CSSProperties, type ReactNode } from 'react';
import type { ScriptureAnnotation } from './analysis';
import { categoryForAnnotation, loadPresentationConfig, type PresentationConfig } from './formatting';
import { useWordComparison } from './wordComparison';

export interface StudyMarkingPreferences { uniqueBeginning: boolean; uniqueEnding: boolean; frequency1: boolean; frequency2: boolean; frequency3: boolean; }
export const defaultStudyMarkingPreferences: StudyMarkingPreferences = { uniqueBeginning: true, uniqueEnding: true, frequency1: true, frequency2: true, frequency3: true };
interface SearchRange { start: number; end: number; }
interface AnnotatedVerseProps { text: string; verseId?: string; annotations?: ScriptureAnnotation[]; preferences?: StudyMarkingPreferences; formatting?: PresentationConfig; searchRanges?: SearchRange[]; className?: string; onFrequencyWord?: (annotation: ScriptureAnnotation, target: HTMLElement) => void; suppressComparison?: boolean; }

export function searchRangesForQuery(text: string, query: string): SearchRange[] {
  const source = query.replace(/^start:|^end:/i, '').replace(/^"|"$/g, '').replace(/\*/g, '').trim();
  if (!source || /^#|^study:/i.test(source) || /^\d/.test(source)) return [];
  const terms = source.split(/\s+(?:and|or)\s+|\s+/i).filter(term => term.length > 1 && !/^\d/.test(term));
  const ranges: SearchRange[] = [];
  for (const term of terms) { const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu'); for (const match of text.matchAll(pattern)) ranges.push({ start: match.index ?? 0, end: (match.index ?? 0) + match[0].length }); }
  return ranges;
}

function enabled(annotation: ScriptureAnnotation, preferences: StudyMarkingPreferences): boolean {
  if (annotation.type === 'unique-beginning') return preferences.uniqueBeginning;
  if (annotation.type === 'unique-ending') return preferences.uniqueEnding;
  if (annotation.type === 'frequency-1') return preferences.frequency1;
  if (annotation.type === 'frequency-2') return preferences.frequency2;
  if (annotation.type === 'frequency-3') return preferences.frequency3;
  return false;
}
function searchClass(active: SearchRange[], start: number, end: number) { return active.some(range => range.start < end && range.end > start) ? ' search-match' : ''; }
function composedStyle(active: ScriptureAnnotation[], formatting: PresentationConfig): CSSProperties | undefined {
  const styles = active.map(annotation => formatting.categories[categoryForAnnotation(annotation.type)]);
  if (!styles.length) return undefined;
  const frequency = active.find(annotation => annotation.type.startsWith('frequency-'));
  const color = frequency ? formatting.categories[categoryForAnnotation(frequency.type)].color : styles.find(item => item.color)?.color;
  const backgroundColor = styles.find(item => item.backgroundColor !== 'transparent')?.backgroundColor;
  const decorations = [...new Set(styles.flatMap(item => [item.underline ? 'underline' : '', item.strikethrough ? 'line-through' : '']).filter(Boolean))];
  return { color, backgroundColor, fontWeight: styles.some(item => item.bold) ? 700 : undefined, fontStyle: styles.some(item => item.italic) ? 'italic' : undefined, textDecoration: decorations.length ? decorations.join(' ') : undefined };
}

export function AnnotatedVerse({ text, verseId, annotations = [], preferences = defaultStudyMarkingPreferences, formatting = loadPresentationConfig(), searchRanges = [], className = '', onFrequencyWord, suppressComparison = false }: AnnotatedVerseProps) {
  const comparison = useWordComparison();
  const valid = annotations.filter(annotation => (!verseId || annotation.verseId === verseId) && enabled(annotation, preferences) && annotation.start >= 0 && annotation.end <= text.length && annotation.start < annotation.end);
  const boundaries = new Set<number>([0, text.length]);
  for (const annotation of valid) { boundaries.add(annotation.start); boundaries.add(annotation.end); }
  for (const range of searchRanges) { boundaries.add(Math.max(0, range.start)); boundaries.add(Math.min(text.length, range.end)); }
  const points = [...boundaries].sort((a, b) => a - b); const pieces: ReactNode[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]; const end = points[index + 1]; const active = valid.filter(annotation => annotation.start <= start && annotation.end >= end);
    const classes = [active.some(annotation => annotation.type === 'unique-beginning' || annotation.type === 'unique-ending') ? 'study-boundary' : '', ...active.filter(annotation => annotation.type.startsWith('frequency-')).map(annotation => `study-${annotation.type}`), searchClass(searchRanges, start, end)].filter(Boolean).join(' ');
    if (active.some(annotation => annotation.type === 'unique-ending' && annotation.start === start && formatting.categories.uniqueEnding.marker)) pieces.push(<span aria-hidden="true" className="study-marker ending-marker" key={`ending-marker-${start}`}>\</span>);
    const frequency = active.find(annotation => annotation.type === 'frequency-2' || annotation.type === 'frequency-3'); const segmentText = text.slice(start, end);
    const content = frequency && onFrequencyWord ? <button type="button" style={composedStyle(active, formatting)} className={`frequency-word study-${frequency.type}`} onClick={event => { event.stopPropagation(); onFrequencyWord(frequency, event.currentTarget); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onFrequencyWord(frequency, event.currentTarget); } }} aria-label={`Show other occurrences of ${frequency.value}`}>{segmentText}</button> : segmentText;
    pieces.push(<span style={composedStyle(active, formatting)} className={classes || undefined} key={`text-${start}-${end}`}>{content}</span>);
    if (active.some(annotation => annotation.type === 'unique-beginning' && annotation.end === end && formatting.categories.uniqueBeginning.marker)) pieces.push(<span aria-hidden="true" className="study-marker beginning-marker" key={`beginning-marker-${end}`}>/</span>);
  }
  return <>{<span className={`annotated-verse ${className}`.trim()} data-original-text={text}>{pieces}</span>}{!suppressComparison && comparison?.activeWord?.annotation.verseId === verseId && <InlineWordComparison comparison={comparison!} preferences={preferences} formatting={formatting}/>}</>;
}

function InlineWordComparison({ comparison, preferences, formatting }: { comparison: NonNullable<ReturnType<typeof useWordComparison>>; preferences: StudyMarkingPreferences; formatting: PresentationConfig }) {
  if (!comparison) return null;
  const { activeWord, occurrences, onClose, panelRef } = comparison;
  useEffect(() => { panelRef.current = document.querySelector('.inline-cross-reference'); return () => { if (panelRef.current?.classList.contains('inline-cross-reference')) panelRef.current = null; }; }, [panelRef]);
  if (!activeWord) return null;
  const frequency = activeWord.annotation.type === 'frequency-2' ? 2 : 3; if (occurrences.length !== frequency) return null;
  const occurrencePreferences = { ...preferences, uniqueBeginning: false, uniqueEnding: false, frequency1: false, frequency2: frequency === 2, frequency3: frequency === 3 };
  return <section ref={panelRef} className="cross-reference-panel inline-cross-reference" role="dialog" aria-label={`Occurrences of ${activeWord.annotation.normalizedValue}`}><div className="cross-reference-heading"><div><strong>Word: {activeWord.annotation.value}</strong><small>{frequency} occurrences · {activeWord.annotation.division} division</small></div><button className="icon-button" onClick={onClose} aria-label="Close word cross-references">×</button></div><div className="cross-reference-list">{occurrences.map(item => <article className={item.verse.id === activeWord.annotation.verseId ? 'current-occurrence' : ''} key={item.annotation.id}><strong>{item.verse.book} {item.verse.chapter}:{item.verse.verse} · #{item.verse.studyNumber}</strong>{item.verse.id === activeWord.annotation.verseId && <small>Current verse</small>}<p><AnnotatedVerse suppressComparison verseId={item.verse.id} text={item.verse.text} annotations={[item.annotation]} preferences={occurrencePreferences} formatting={formatting}/></p></article>)}</div></section>;
}
