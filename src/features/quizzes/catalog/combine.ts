import type { PublishedQuiz, QuizCatalog, QuizCollection, QuizQuestion } from '../types';

export function combineCatalogs(bundled: QuizCatalog | undefined, installed: QuizCatalog[]): QuizCatalog | undefined {
  const catalogs = [...installed].sort((a, b) => b.installedAt.localeCompare(a.installedAt));
  if (bundled) catalogs.unshift(bundled);
  const primary = catalogs[0];
  if (!primary || catalogs.length === 1) return primary;

  const collections = new Map<string, QuizCollection>();
  const quizzes = new Map<string, PublishedQuiz>();
  const questions = new Map<string, QuizQuestion>();
  for (const catalog of catalogs) {
    const newCollections = new Set(catalog.collections.filter(item => !collections.has(item.id)).map(item => item.id));
    const newQuizzes = catalog.quizzes.filter(quiz => newCollections.has(quiz.collectionId) && !quizzes.has(quiz.id));
    const newQuizIds = new Set(newQuizzes.map(quiz => quiz.id));
    for (const collection of catalog.collections) {
      if (newCollections.has(collection.id)) {
        collections.set(collection.id, { ...collection, quizIds: collection.quizIds.filter(id => newQuizIds.has(id)) });
      }
    }
    const linkedQuestions = new Set(catalog.quizzes.flatMap(quiz => quiz.questionIds));
    const newLinkedQuestions = new Set(newQuizzes.flatMap(quiz => quiz.questionIds));
    for (const quiz of newQuizzes) quizzes.set(quiz.id, quiz);
    for (const question of catalog.questions) {
      const belongsToNewCollection = question.collectionId ? newCollections.has(question.collectionId) : !linkedQuestions.has(question.id);
      if ((belongsToNewCollection || newLinkedQuestions.has(question.id)) && !questions.has(question.id)) questions.set(question.id, question);
    }
  }
  return { ...primary, collections: [...collections.values()], quizzes: [...quizzes.values()], questions: [...questions.values()] };
}
