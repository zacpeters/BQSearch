import { createContext, useSyncExternalStore, type RefObject } from 'react';
import type { ScriptureAnnotation } from './analysis';
import type { ScripturePack } from './types';

export interface ActiveWordComparison { activeWord: { annotation: ScriptureAnnotation; target: HTMLElement } | null; occurrences: { annotation: ScriptureAnnotation; verse: ScripturePack['verses'][number] }[]; onClose: () => void; panelRef: RefObject<HTMLElement | null>; }
export const WordComparisonContext = createContext<ActiveWordComparison | null>(null);

let comparisonState: ActiveWordComparison | null = null;
const listeners = new Set<() => void>();
export function setWordComparisonState(next: ActiveWordComparison | null) { comparisonState = next; listeners.forEach(listener => listener()); }
export function useWordComparison(): ActiveWordComparison | null { return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => comparisonState, () => null); }
