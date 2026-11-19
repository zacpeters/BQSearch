import { useMemo, type Ref } from 'react';
import { Ellipsis } from 'lucide-react';
import { deleteGeneratedQuiz, saveGeneratedQuiz } from '../storage/generator-storage';
import type { GeneratedQuiz, QuizQuestion } from '../types';

type Props = {
  quizzes: GeneratedQuiz[];
  questions: QuizQuestion[];
  onOpen: (quiz: GeneratedQuiz) => void;
  onChanged: () => Promise<void>;
  sectionRef: Ref<HTMLElement>;
};

export function GeneratedQuizList({ quizzes, questions, onOpen, onChanged, sectionRef }: Props) {
  const questionIds = useMemo(() => new Set(questions.map(question => question.id)), [questions]);
  const rename = async (quiz: GeneratedQuiz) => {
    const title = prompt('Quiz name', quiz.title)?.trim();
    if (!title) return;
    await saveGeneratedQuiz({ ...quiz, title, updatedAt: new Date().toISOString() });
    await onChanged();
  };
  const duplicate = async (quiz: GeneratedQuiz) => {
    const now = new Date().toISOString();
    await saveGeneratedQuiz({ ...quiz, id: `custom-${crypto.randomUUID()}`, title: `${quiz.title} copy`, createdAt: now, updatedAt: now });
    await onChanged();
  };
  const remove = async (quiz: GeneratedQuiz) => {
    if (!confirm(`Delete ${quiz.title}?`)) return;
    await deleteGeneratedQuiz(quiz.id);
    await onChanged();
  };
  return (
    <section className="content-section saved-quiz-section" aria-labelledby="saved-quiz-heading" tabIndex={-1} ref={sectionRef}>
      <div className="section-heading"><h2 id="saved-quiz-heading">Saved quizzes</h2></div>
      {quizzes.map(quiz => {
        const missing = quiz.questionIds.filter(id => !questionIds.has(id)).length;
        return (
          <div className="saved-quiz-entry" key={quiz.id}>
            <button className="saved-row full" onClick={() => onOpen(quiz)}>
              <span><strong>{quiz.title}</strong><small>{quiz.questionIds.length} questions</small>
                {missing > 0 && <small>{missing} {missing === 1 ? 'question unavailable' : 'questions unavailable'}</small>}
              </span>
              <span>Open →</span>
            </button>
            <details className="saved-quiz-options">
              <summary className="icon-button" aria-label={`Options for ${quiz.title}`}><Ellipsis size={16} aria-hidden="true"/></summary>
              <div className="saved-quiz-actions">
                <button onClick={() => void rename(quiz)}>Rename</button>
                <button onClick={() => void duplicate(quiz)}>Duplicate</button>
                <button onClick={() => void remove(quiz)}>Delete</button>
              </div>
            </details>
          </div>
        );
      })}
    </section>
  );
}
