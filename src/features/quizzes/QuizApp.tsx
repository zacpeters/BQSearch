import { useEffect, useMemo, useRef, useState } from 'react';
import { Ellipsis } from 'lucide-react';
import type { Division, ScripturePack } from '../../types';
import { readRoute, type QuizRoute } from '../../app-navigation';
import { loadBundledCatalog } from './catalog/bundled';
import { combineCatalogs } from './catalog/combine';
import { listCatalogs, saveCatalog } from './catalog/storage';
import { readCatalogFile } from './catalog/loader';
import { LibraryV5 } from './library/QuizLibrary';
import { QuestionBankV5 } from './question-bank/QuestionBank';
import { QuizGenerator } from './generator/QuizGenerator';
import { GeneratedQuizList } from './generator/GeneratedQuizList';
import { listGeneratedQuizzes } from './storage/generator-storage';
import { listQuizSessions, listUserCollections, listUserQuestions } from './storage/user-storage';
import { exportMigrationBundle } from '../../integration/migration';
import { createPackScriptureProvider } from '../../integration/scripture-provider';
import { studyOptions } from './generator';
import { PracticeWorkspace } from './practice/PracticeWorkspace';
import { downloadQuizData } from './v5-format';
import type { GeneratedQuiz, QuizCatalog, QuizPracticeSession, QuizQuestion, UserCollection, UserQuestion } from './types';
import './quiz-navigation.css';
import './v5-library-bank.css';

const tabs = [
  ['library', 'Library'],
  ['bank', 'Question Bank'],
  ['generator', 'Generate Quiz'],
] as const;

export default function QuizApp({ pack, division, studyStart, studyEnd, route, onNavigate }: {
  pack: ScripturePack; division: Division; studyStart: number; studyEnd: number;
  route: QuizRoute; onNavigate: (next: QuizRoute) => void;
}) {
  const { tab } = route;
  const [bundled, setBundled] = useState<QuizCatalog>();
  const [installed, setInstalled] = useState<QuizCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [userCollections, setUserCollections] = useState<UserCollection[]>([]);
  const [userQuestions, setUserQuestions] = useState<UserQuestion[]>([]);
  const [generatedQuizzes, setGeneratedQuizzes] = useState<GeneratedQuiz[]>([]);
  const [launchedQuiz, setLaunchedQuiz] = useState<GeneratedQuiz>();
  const [sessions, setSessions] = useState<QuizPracticeSession[]>([]);
  const [loadMessage, setLoadMessage] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [expectedDigest, setExpectedDigest] = useState('');
  const [importing, setImporting] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const savedSection = useRef<HTMLElement>(null);
  const focusSavedAfterNavigation = useRef(false);
  const catalog = useMemo(() => combineCatalogs(bundled, installed), [bundled, installed]);
  const practiceScripture = useMemo(() => createPackScriptureProvider(pack, { division }), [pack, division]);
  const v5Content = useMemo(() => {
    const publishedCollections = new Set(catalog?.collections.map(collection => collection.id));
    const publishedQuestions = new Set(catalog?.questions.map(question => question.id));
    const collections = userCollections.filter(collection => !publishedCollections.has(collection.id));
    const questions = userQuestions.filter(question => !publishedCollections.has(question.collectionId) && !publishedQuestions.has(question.id));
    const published = catalog?.questions ?? [];
    const userQuestionIds = new Set(userQuestions.map(question => question.id));
    const savedQuestions = [...published.filter(question => !userQuestionIds.has(question.id)), ...userQuestions.filter(question => !publishedQuestions.has(question.id))];
    return { collections, questions, savedQuestions, allCollections: [...(catalog?.collections ?? []), ...collections], allQuestions: [...published, ...questions] };
  }, [catalog, userCollections, userQuestions]);

  const refreshUserData = async () => {
    const [collections, questions, saved] = await Promise.all([listUserCollections(), listUserQuestions(), listGeneratedQuizzes()]);
    setUserCollections(collections);
    setUserQuestions(questions);
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
    if (loading || route.practice || tab !== 'library') return;
    let active = true;
    void listQuizSessions().then(value => { if (active) setSessions(value); },
      () => { if (active) setLoadMessage('Unable to load recent practice history.'); });
    return () => { active = false; };
  }, [loading, route.practice?.id, tab]);

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

  const exportUserData = async () => {
    try {
      const [collections, questions] = await Promise.all([listUserCollections(), listUserQuestions()]);
      downloadQuizData('bqquiz-user-content.json', { schemaVersion: 1, collections, questions });
    } catch {
      setLoadMessage('Unable to export user collections and questions.');
    }
  };

  const exportBackup = async () => {
    try {
      const bundle = await exportMigrationBundle({ catalogId: catalog?.catalogId, catalogVersion: catalog?.catalogVersion });
      downloadQuizData('bqquiz-user-backup.json', bundle);
    } catch {
      setImportMessage('Unable to export the quiz backup.');
    }
  };

  if (loading) return <div className="loading" role="status">Loading quiz catalogs…</div>;

  if (route.practice) {
    const { id, kind } = route.practice;
    const quiz = kind === 'saved' ? generatedQuizzes.find(item => item.id === id) : kind === 'generated' ? launchedQuiz : catalog?.quizzes.find(item => item.id === id);
    const index = new Map((kind === 'published' ? v5Content.allQuestions : v5Content.savedQuestions).map(question => [question.id, question]));
    const onBack = () => {
      onNavigate({ view: 'quizzes', tab: 'library' });
      window.scrollTo(0, 0);
    };
    return <section className="quiz-shell" aria-label="Quizzes">
      {quiz ? <PracticeWorkspace key={`${kind}:${id}`} quiz={quiz} questions={quiz.questionIds.map(questionId => index.get(questionId))}
        scriptureProvider={practiceScripture} onBack={onBack}/>
        : <div className="quiz-message" role="status">This quiz is unavailable in this browser.<button onClick={onBack}>‹ Library</button></div>}
    </section>;
  }

  return (
    <section className="quiz-shell" aria-label="Quizzes">
      <div className="quiz-context">
        {catalog && <nav className="search-assist" aria-label="Quiz sections">
          {tabs.map(([id, label]) => (
            <button key={id} aria-pressed={tab === id} onClick={() => onNavigate({ view: 'quizzes', tab: id })}>{label}</button>
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
              <button className="secondary-button compact" onClick={() => void exportBackup()}>Export five-store backup</button>
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
      {catalog && tab === 'library' && <LibraryV5 collections={v5Content.allCollections} quizzes={catalog.quizzes} questions={v5Content.allQuestions} sessions={sessions} collectionId={route.collectionId}
        onSelectCollection={collectionId => onNavigate({ view: 'quizzes', tab: 'library', collectionId })} onOpen={quiz => {
        onNavigate({ ...route, practice: { id: quiz.id, kind: 'collectionId' in quiz ? 'published' : 'saved' } });
        window.scrollTo(0, 0);
      }} renderSavedQuizzes={onOpen => generatedQuizzes.length > 0 && (
        <GeneratedQuizList quizzes={generatedQuizzes} questions={v5Content.savedQuestions} onOpen={onOpen} onChanged={refreshUserData} sectionRef={savedSection}/>
      )}/>}
      {catalog && tab === 'bank' && <QuestionBankV5 catalog={catalog} userCollections={v5Content.collections} userQuestions={v5Content.questions} customQuizzes={generatedQuizzes} referenceOptions={studyOptions(pack, division)} onChanged={refreshUserData} onExport={() => void exportUserData()}/>}
      {catalog && tab === 'generator' && <QuizGenerator key={JSON.stringify([pack.id, pack.version, division, studyStart, studyEnd])} catalog={catalog} userCollections={v5Content.collections} userQuestions={v5Content.questions} pack={pack} division={division} studyStart={studyStart} studyEnd={studyEnd} onLaunch={quiz => { setLaunchedQuiz(quiz); onNavigate({ view: 'quizzes', tab: 'generator', practice: { id: quiz.id, kind: 'generated' } }); }} onSaved={async () => {
        await refreshUserData();
        const current = readRoute(new URL(window.location.href), true);
        if (current.view !== 'quizzes' || current.tab !== 'generator') return;
        focusSavedAfterNavigation.current = true;
        onNavigate({ view: 'quizzes', tab: 'library' });
      }}/>}
    </section>
  );
}
