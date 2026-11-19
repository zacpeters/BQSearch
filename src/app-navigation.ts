import { useCallback, useEffect, useState } from 'react';

export type QuizTab = 'library' | 'bank' | 'generator';
export type QuizRoute = {
  view: 'quizzes';
  tab: QuizTab;
  collectionId?: string;
  practice?: { kind: 'published' | 'saved'; id: string };
};
type Route = QuizRoute | { view: 'search' | 'settings' | 'scorer' };

export function readRoute(url: URL, quizzesEnabled: boolean): Route {
  const view = url.searchParams.get('view');
  if (view === 'settings' || view === 'scorer') return { view };
  if (view !== 'quizzes' || !quizzesEnabled) return { view: 'search' };
  const section = url.searchParams.get('quizTab');
  const tab = section === 'bank' || section === 'generator' ? section : 'library';
  if (tab !== 'library') return { view, tab };
  const collectionId = url.searchParams.get('collection') || undefined;
  const id = url.searchParams.get('quiz');
  const kind = url.searchParams.get('quizKind');
  return { view, tab, collectionId, practice: id && (kind === 'published' || kind === 'saved') ? { id, kind } : undefined };
}

export function useAppNavigation(quizzesEnabled: boolean) {
  const [route, setRoute] = useState(() => readRoute(new URL(window.location.href), quizzesEnabled));
  useEffect(() => {
    const restore = () => setRoute(readRoute(new URL(window.location.href), quizzesEnabled));
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [quizzesEnabled]);

  const navigate = useCallback((next: Route) => {
    const url = new URL(window.location.href);
    for (const key of ['view', 'quizTab', 'collection', 'quiz', 'quizKind']) url.searchParams.delete(key);
    if (next.view !== 'search') url.searchParams.set('view', next.view);
    if (next.view === 'quizzes') {
      if (next.tab !== 'library') url.searchParams.set('quizTab', next.tab);
      if (next.collectionId) url.searchParams.set('collection', next.collectionId);
      if (next.practice) {
        url.searchParams.set('quiz', next.practice.id);
        url.searchParams.set('quizKind', next.practice.kind);
      }
    }
    if (url.href !== window.location.href) window.history.pushState(null, '', url);
    setRoute(next);
  }, []);
  return [route, navigate] as const;
}
