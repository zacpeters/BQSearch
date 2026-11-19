import { useState, type ReactNode } from 'react';
import './bqquiz-frame.css';

const primaryTabs = [
  ['library', 'Library'],
  ['bank', 'Question Bank'],
  ['generator', 'Generate Quiz'],
] as const;

export type QuizTab = (typeof primaryTabs)[number][0] | 'saved';

export function BQQuizFrame({ tab, onTab, hasCatalog, questionCount, sourceStatus, children }: {
  tab: QuizTab;
  onTab: (tab: QuizTab) => void;
  hasCatalog: boolean;
  questionCount: number;
  sourceStatus?: string;
  children: ReactNode;
}) {
  const [dark, setDark] = useState(false);

  return (
    <section className="bqquiz-v5" aria-label="BQQuiz" data-bqquiz-theme={dark ? 'dark' : 'light'}>
      <header className="app-header">
        <button className="brand" onClick={() => onTab('library')} aria-label="BQQuiz Library">
          <span className="brand-mark" aria-hidden="true">BQ</span>
          <span><strong>BQQuiz</strong><small>Practice locally</small></span>
        </button>
        {hasCatalog && <nav className="main-nav" aria-label="BQQuiz navigation">
          {primaryTabs.map(([id, label]) => (
            <button key={id} className={tab === id ? 'active' : undefined} aria-current={tab === id ? 'page' : undefined} onClick={() => onTab(id)}>{label}</button>
          ))}
        </nav>}
        <button className="theme-toggle" onClick={() => setDark(!dark)} aria-label="Toggle dark mode" aria-pressed={dark}>{dark ? '☼' : '☾'}</button>
        <span className="status-chip"><i /> Offline ready</span>
      </header>
      {children}
      {sourceStatus && <footer className="app-footer">
        <span>{sourceStatus === 'verified-with-audit' ? '2027 selected Psalms · ' : ''}{questionCount} imported questions</span>
        <span>{sourceStatus === 'verified-with-audit' ? 'Local source data verified with audit' : sourceStatus}</span>
      </footer>}
    </section>
  );
}
