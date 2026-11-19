import { useMemo, useState, type ReactNode } from 'react';
import type { QuizPracticeSession, GeneratedQuiz, PublishedQuiz, QuizCollection, QuizQuestion } from '../types';
import { observedCoverage } from '../v5-format';

type QuizSelection = PublishedQuiz | GeneratedQuiz;
type Props = {
  collections: QuizCollection[];
  quizzes: PublishedQuiz[];
  questions: QuizQuestion[];
  sessions: QuizPracticeSession[];
  collectionId?: string;
  onSelectCollection: (id?: string) => void;
  onOpen: (quiz: QuizSelection) => void;
  renderSavedQuizzes: (onOpen: (quiz: GeneratedQuiz) => void) => ReactNode;
};

export function LibraryV5({ collections, quizzes, questions, sessions, collectionId, onSelectCollection, onOpen, renderSavedQuizzes }: Props) {
  const [search, setSearch] = useState('');
  const visible = collections.filter(c => `${c.name} ${c.publisher} ${c.year ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  const current = collections.find(c => c.id === collectionId);
  const currentQuizzes = quizzes.filter(q => q.collectionId === collectionId);
  const questionsById = useMemo(() => new Map(questions.map(question => [question.id, question])), [questions]);
  const recent = useMemo(() => {
    const published = new Map(quizzes.map(quiz => [quiz.id, quiz]));
    return sessions.filter(session => published.has(session.quizId)).sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')).slice(0, 5)
      .map(session => ({ ...session, quiz: published.get(session.quizId)! }));
  }, [quizzes, sessions]);
  const summary = (collection: QuizCollection) => {
    const rows = questions.filter(q => q.collectionId === collection.id);
    return { questions: rows.length, quizzes: quizzes.filter(q => q.collectionId === collection.id).length, coverage: observedCoverage(rows) };
  };

  return (
    <section className="bqquiz-v5 page library-v5">
      {!current ? <>
        <div className="page-title">
          <div><span className="overline">LIBRARY</span><h1>Collections</h1></div>
          <input aria-label="Search collections" placeholder="Search collections" value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <div className="collection-cards">{visible.map(collection => {
          const counts = summary(collection);
          return (
            <button className="collection-card" key={collection.id} onClick={() => onSelectCollection(collection.id)}>
              <strong>{collection.name}</strong><span>{collection.publisher} · {collection.year ?? '—'}</span>
              <small>{counts.quizzes} quizzes · {counts.questions} questions</small><small>{counts.coverage}</small>
            </button>
          );
        })}</div>
        {!visible.length && <p className="quiet">No collections match this search.</p>}
        {renderSavedQuizzes(onOpen)}
        {recent.length > 0 && <section className="content-section">
          <div className="section-heading"><h2>Recent practice</h2></div>
          {recent.map(session => <div className="recent-row" key={session.id}>
            <span><strong>{collections.find(collection => collection.id === session.quiz.collectionId)?.publisher} · Quiz {String(session.quiz.quizNumber).padStart(2, '0')}</strong></span>
          </div>)}
        </section>}
      </> : <>
        <div className="page-title"><div>
          <button className="text-button" onClick={() => onSelectCollection()}>‹ Collections</button>
          <h1>{current.name}</h1><p>{current.publisher} · {current.year ?? '—'} · {summary(current).coverage}</p>
        </div></div>
        <div className="quiz-list">{currentQuizzes.map(quiz => (
          <button className="quiz-row" key={quiz.id} onClick={() => onOpen(quiz)}>
            <span className="quiz-index">{String(quiz.quizNumber).padStart(2, '0')}</span>
            <span><strong>Quiz {quiz.quizNumber}</strong><small>{quiz.questionIds.length} questions · References: {observedCoverage(quiz.questionIds.flatMap(id => questionsById.get(id) ?? []))}</small></span>
            <span className="row-arrow">→</span>
          </button>
        ))}</div>
        {!currentQuizzes.length && <p className="quiet">No published quizzes in this collection.</p>}
      </>}
    </section>
  );
}
