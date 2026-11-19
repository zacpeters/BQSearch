import { useState, type Ref } from 'react';
import { deleteGeneratedQuiz, saveGeneratedQuiz } from '../storage/generator-storage';
import type { GeneratedQuiz, QuizCatalog, UserQuestion } from '../types';

export function GeneratedQuizList({ quizzes, catalog, userQuestions, onChanged, sectionRef }: { quizzes: GeneratedQuiz[]; catalog: QuizCatalog; userQuestions: UserQuestion[]; onChanged: () => Promise<void>; sectionRef: Ref<HTMLElement> }) {
  const [message, setMessage] = useState('');
  const questions = (quiz: GeneratedQuiz) => quiz.questionIds.map(id => [...catalog.questions, ...userQuestions].find(question => question.id === id)).filter(Boolean);
  const rename = async (quiz: GeneratedQuiz) => { const title = prompt('Quiz name', quiz.title)?.trim(); if (!title) return; await saveGeneratedQuiz({ ...quiz, title, updatedAt: new Date().toISOString() }); await onChanged(); };
  const duplicate = async (quiz: GeneratedQuiz) => { await saveGeneratedQuiz({ ...quiz, id: `custom-${crypto.randomUUID()}`, title: `${quiz.title} copy`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); await onChanged(); };
  const remove = async (quiz: GeneratedQuiz) => { if (!confirm(`Delete ${quiz.title}?`)) return; await deleteGeneratedQuiz(quiz.id); await onChanged(); };
  return <section className="saved-quiz-section" aria-labelledby="saved-quiz-heading" tabIndex={-1} ref={sectionRef}><h2 id="saved-quiz-heading">Saved quizzes</h2>{message && <div className="quiz-message">{message}</div>}<div className="saved-quiz-list">{quizzes.map(quiz => { const missing = quiz.questionIds.length - questions(quiz).length; return <article className="saved-quiz-card" key={quiz.id}><div><strong>{quiz.title}</strong><small>{quiz.questionIds.length} questions · {quiz.totalPoints} possible points · seed {quiz.seed}</small><small>{missing ? `${missing} question${missing === 1 ? '' : 's'} missing from the installed catalog` : `${[quiz.filters.division, quiz.filters.strategy, quiz.catalogVersion].filter(Boolean).join(' · ')}`}</small></div><div className="saved-quiz-actions"><button onClick={() => void rename(quiz)}>Rename</button><button onClick={() => void duplicate(quiz)}>Duplicate</button><button onClick={() => void remove(quiz)}>Delete</button></div></article>; })}</div></section>;
}
