import { useEffect, useMemo, useRef, useState } from 'react';
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

const tabs = [
  ['library', 'Library'],
  ['bank', 'Question Bank'],
  ['generator', 'Generate Quiz'],
  ['saved', 'Saved Quizzes'],
] as const;

export default function QuizApp({ pack, division, studyStart, studyEnd, onBack }: { pack: ScripturePack; division: Division; studyStart: number; studyEnd: number; onBack: () => void }) {
  const [bundled, setBundled] = useState<QuizCatalog>();
  const [installed, setInstalled] = useState<QuizCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof tabs)[number][0]>('library');
  const [userCollections, setUserCollections] = useState<UserCollection[]>([]);
  const [userQuestions, setUserQuestions] = useState<UserQuestion[]>([]);
  const [generatedQuizzes, setGeneratedQuizzes] = useState<GeneratedQuiz[]>([]);
  const [loadMessage, setLoadMessage] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [expectedDigest, setExpectedDigest] = useState('');
  const [importing, setImporting] = useState(false);
  const input = useRef<HTMLInputElement>(null);
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
    <section className="quiz-shell">
      <div className="quiz-nav">
        <div>
          <span className="context-label">QUIZZES</span>
          <strong>{catalog?.sourceSet.title ?? 'Quiz catalogs'}</strong>
          {catalog && <small>{catalog.catalogVersion} · {bundled ? 'bundled' : 'local'} · SHA-256 {catalog.catalogDigest?.slice(0, 12) ?? 'unavailable'}</small>}
        </div>
        <div className="quiz-nav-actions">
          {catalog && tabs.map(([id, label]) => <button key={id} className={tab === id ? 'selected' : ''} onClick={() => setTab(id)}>{label}</button>)}
          <button onClick={onBack}>Lookup</button>
        </div>
      </div>
      {loadMessage && <div className="quiz-message" role="status">{loadMessage}<button onClick={() => setLoadMessage('')}>Dismiss</button></div>}
      {!catalog && <div className="quiz-empty">No published catalog is available.</div>}
      {catalog && tab === 'library' && <QuizLibrary catalog={catalog} onBack={onBack}/>}
      {catalog && tab === 'bank' && <QuestionBank catalog={catalog} userCollections={userCollections} userQuestions={userQuestions} pack={pack} division={division} studyStart={studyStart} studyEnd={studyEnd} onChanged={refreshUserData} onBack={onBack}/>}
      {catalog && tab === 'generator' && <QuizGenerator catalog={catalog} userCollections={userCollections} userQuestions={userQuestions} pack={pack} division={division} studyStart={studyStart} studyEnd={studyEnd} onSaved={async () => { await refreshUserData(); setTab('saved'); }} onBack={onBack}/>}
      {catalog && tab === 'saved' && <GeneratedQuizList quizzes={generatedQuizzes} catalog={catalog} userQuestions={userQuestions} onChanged={refreshUserData} onBack={onBack}/>}
      <details className="quiz-editor">
        <summary>Advanced catalog options</summary>
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
      </details>
    </section>
  );
}
