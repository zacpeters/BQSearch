import { useEffect, useRef, useState } from 'react';
import type { ScriptureProvider } from '../../../integration/contracts';
import type { QuizQuestion } from '../types';
import { openPracticeSession, savePracticeSession } from '../storage/user-storage';
import type { PracticeSession } from './practice';
import { PracticeViewerV5, type PracticeQuiz } from './PracticeViewerV5';
import './practice-v5.css';

export function PracticeWorkspace({ quiz, questions, scriptureProvider, onBack }: {
  quiz: PracticeQuiz;
  questions: (QuizQuestion | undefined)[];
  scriptureProvider: ScriptureProvider;
  onBack: () => void;
}) {
  const [session, setSession] = useState<PracticeSession>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  useEffect(() => {
    let active = true;
    void openPracticeSession(quiz.id).then(
      value => { if (active) setSession(value); },
      reason => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to open the practice session.'); },
    );
    return () => { active = false; };
  }, [quiz.id]);

  const save = async (next: PracticeSession) => {
    if (!session || inFlight.current) return false;
    inFlight.current = true;
    setSaving(true);
    setError('');
    try {
      await savePracticeSession(next, next.id === session.id ? session : undefined);
      setSession(next);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save the practice session.');
      return false;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  if (!session) return (
    <div className="quiz-message" role={error ? 'alert' : 'status'}>
      {error || 'Opening practice…'}<button onClick={onBack}>‹ Library</button>
    </div>
  );

  return <PracticeViewerV5 quiz={quiz} questions={questions} session={session} save={save} saving={saving} saveError={error} scriptureProvider={scriptureProvider} onBack={onBack}/>;
}
