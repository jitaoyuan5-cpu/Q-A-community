import type { Answer, QAState, Question } from "../types";

export type HomeTab = "newest" | "hot" | "unanswered";

export const findUser = (state: QAState, userId: string) => state.users.find((u) => u.id === userId);

export const isFollowing = (state: QAState, questionId: string) => state.follows.some((f) => f.questionId === questionId);
export const isFavorited = (state: QAState, targetType: "question" | "article", targetId: string) =>
  state.favorites.some((f) => f.targetType === targetType && f.targetId === targetId);

export const answersByQuestion = (state: QAState, questionId: string): Answer[] =>
  state.answers.filter((a) => a.questionId === questionId);

const matchesKeyword = (question: Question, keyword: string) => {
  const q = keyword.trim().toLowerCase();
  if (!q) return true;
  return (
    question.title.toLowerCase().includes(q) ||
    question.content.toLowerCase().includes(q) ||
    question.tags.some((tag) => tag.toLowerCase().includes(q))
  );
};

export const selectQuestionsForHome = (state: QAState, tab: HomeTab, keyword: string): Question[] => {
  const filtered = state.questions.filter((q) => matchesKeyword(q, keyword));
  switch (tab) {
    case "hot":
      return [...filtered].sort((a, b) => b.votes - a.votes || b.views - a.views);
    case "unanswered":
      return filtered
        .filter((q) => q.answers === 0)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case "newest":
    default:
      return [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
};

export const selectFollowingQuestions = (state: QAState): (Question & { hasNewAnswers: boolean })[] => {
  const map = new Map(state.follows.map((f) => [f.questionId, f.hasNewAnswers]));
  return state.questions
    .filter((q) => map.has(q.id))
    .map((q) => ({ ...q, hasNewAnswers: map.get(q.id) ?? false }))
    .sort((a, b) => Number(b.hasNewAnswers) - Number(a.hasNewAnswers));
};
