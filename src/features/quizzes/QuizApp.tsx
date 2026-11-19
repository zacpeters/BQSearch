import { useEffect, useMemo, useRef, useState } from 'react';
import { Ellipsis } from 'lucide-react';
import type { Division, ScripturePack } from '../../types';
import { loadBundledCatalog } from './catalog/bundled';
import { combineCatalogs } from './catalog/combine';
import { listCatalogs, saveCatalog } from './catalog/storage';
import { readCatalogFile } from './catalog/loader';
import { QuizLibrary } from './library/QuizLibrary';
import { loadUserQuestionState, QuestionBank } from './question-bank/QuestionBank';
import { QuizGenerator } from './generator/QuizGenerator';
import { GeneratedQuizList } from './generator/GeneratedQuizList';
import { listGeneratedQuizzes } from './storage/generator-storage';
import type { GeneratedQuiz, QuizCatalog, UserCollection, UserQuestion } from './types';
import './quiz-navigation.css';

const tabs = [
  ['library', 'Library'],
  ['bank', 'Question Bank'],
  ['generator', 'Generate Quiz'],
] as const;

type QuizTab = (typeof tabs)[number][0];

export default function QuizApp({ pack, division, studyStart, studyEnd }: { pack: ScripturePack; division: Division; studyStart: number; studyEnd: number }) {
  const [bundled, setBundled] = useState<QuizCatalog>();
  const [installed, setInstalled] = useState<QuizCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<QuizTab>('library');
  const [userCollections, setUserCollections] = useState<UserCollection[]>([]);
  const [userQuestions, setUserQuestions] = useState<UserQuestion[]>([]);
  const [generatedQuizzes, setGeneratedQuizzes] = useState<GeneratedQuiz[]>([]);
  const [loadMessage, setLoadMessage] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [expectedDigest, setExpectedDigest] = useState('');
  const [importing, setImporting] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const savedSection = useRef<HTMLElement>(null);
  const focusSavedAfterNavigation = useRef(false);
  const catalog = useMemo(() => combineCatalogs(bundled, installed), [bundled, installed]);

  const refreshUserData = async () => {
    const [users, saved] = await Promise.all([loadUserQuestionState(), listGeneratedQuizzes()]);
    setUserCollections(users.collections);
    setUserQuestions(users.questions);
    setGeneratedQuizzes(saved);
  };

  useEffect(() => {
    void Promise.allSettled([
      loadBundledCatalog().then(setBundled),
      listCatalogs().then(setInstalled),
      refreshUserData(),
    ]).then(([published, local, user]) => {
      if (published.status === 'rejected') setLoadMessage('Unable to load the bundled quiz catalog. Reopen Quizzes to retry.');
      if (local.status === 'rejected' || user.status === 'rejected') setLoadMessage('Unable to load some local quiz data. Reopen Quizzes to retry.');
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (tab !== 'library' || !focusSavedAfterNavigation.current) return;
    focusSavedAfterNavigation.current = false;
    savedSection.current?.focus({ preventScroll: true });
    savedSection.current?.scrollIntoView({ block: 'nearest' });
  }, [tab]);

  const install = async (file: File) => {
    setImporting(true);
    setImportMessage('');
    try {
      const result = await readCatalogFile(file, expectedDigest);
      if (!result.catalog) {
        setImportMessage([...result.errors, ...result.warnings].join(' '));
        return;
      }
      await saveCatalog(result.catalog);
      setInstalled(await listCatalogs());
      setImportMessage(`Installed ${result.catalog.sourceSet.title} locally. SHA-256 ${result.catalog.catalogDigest}.`);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'Unable to install the local catalog.');
    } finally {
      setImporting(false);
    }
  };

  if (loading) return <div className="loading" role="status">Loading quiz catalogs…</div>;

  return (
    <section className="quiz-shell" aria-label="Quizzes">
      <div className="quiz-context">
        {catalog && <nav className="search-assist" aria-label="Quiz sections">
          {tabs.map(([id, label]) => (
            <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>
          ))}
        </nav>}
        <details className="quiz-catalog-options">
          <summary className="icon-button" aria-label="Advanced catalog options" title="Advanced catalog options">
            <Ellipsis size={16} aria-hidden="true"/>
            {!catalog && 'Advanced catalog options'}
          </summary>
          <div className="quiz-editor quiz-catalog-panel">
            {catalog && <small>{catalog.sourceSet.title} · {catalog.catalogVersion} · {bundled ? 'bundled' : 'local'} · SHA-256 {catalog.catalogDigest ?? 'unavailable'}</small>}
            <p>Install a reviewed JSON catalog in this browser. Collections in the bundled catalog take precedence when IDs match.</p>
            <div className="quiz-actions">
              <input className="digest-input" aria-label="Expected catalog SHA-256" placeholder="Optional trusted SHA-256 digest" value={expectedDigest} onChange={event => setExpectedDigest(event.target.value)}/>
              <button className="secondary-button compact" disabled={importing} onClick={() => input.current?.click()}>Install local catalog</button>
              <input ref={input} hidden type="file" accept=".json" onChange={event => {
                const file = event.target.files?.[0];
                if (file) void install(file);
                event.currentTarget.value = '';
              }}/>
            </div>
            {importMessage && <div className="quiz-message" role="status">{importMessage}</div>}
          </div>
        </details>
      </div>
      {loadMessage && <div className="quiz-message" role="status">{loadMessage}<button onClick={() => setLoadMessage('')}>Dismiss</button></div>}
      {!catalog && <div className="quiz-empty">No published catalog is available.</div>}
      {catalog && tab === 'library' && <QuizLibrary catalog={catalog} savedQuizzes={generatedQuizzes.length > 0 && (
        <GeneratedQuizList quizzes={generatedQuizzes} catalog={catalog} userQuestions={userQuestions} onChanged={refreshUserData} sectionRef={savedSection}/>
      )}/>}
      {catalog && tab === 'bank' && <QuestionBank catalog={catalog} userCollections={userCollections} userQuestions={userQuestions} pack={pack} division={division} studyStart={studyStart} studyEnd={studyEnd} onChanged={refreshUserData}/>}
      {catalog && tab === 'generator' && <QuizGenerator catalog={catalog} userCollections={userCollections} userQuestions={userQuestions} pack={pack} division={division} studyStart={studyStart} studyEnd={studyEnd} onSaved={async () => {
        await refreshUserData();
        focusSavedAfterNavigation.current = true;
        setTab('library');
      }}/>}
    </section>
  );
}
