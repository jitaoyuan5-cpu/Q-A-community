import type { QAState, Question } from "../types";

export type QAAction =
  | { type: "ADD_QUESTION"; payload: { title: string; content: string; tags: string[] } }
  | { type: "ADD_ANSWER"; payload: { questionId: string; content: string } }
  | { type: "TOGGLE_VOTE"; payload: { target: "question" | "answer"; id: string; delta: 1 | -1 } }
  | { type: "ACCEPT_ANSWER"; payload: { answerId: string } }
  | { type: "TOGGLE_FOLLOW_QUESTION"; payload: { questionId: string } }
  | { type: "MARK_QUESTION_VIEWED"; payload: { questionId: string } }
  | { type: "MARK_FOLLOW_SEEN"; payload: { questionId: string } };

const nowIso = () => new Date().toISOString();

const updateQuestionAnswerCount = (state: QAState, questionId: string): QAState => {
  const count = state.answers.filter((a) => a.questionId === questionId).length;
  return {
    ...state,
    questions: state.questions.map((q) => (q.id === questionId ? { ...q, answers: count, updatedAt: nowIso() } : q)),
  };
};

const applyVote = (
  state: QAState,
  target: "question" | "answer",
  id: string,
  requestedDelta: 1 | -1,
): QAState => {
  const key = `${target}:${id}`;
  const previous = state.voteRecord[key] ?? 0;
  const nextVote = previous === requestedDelta ? 0 : requestedDelta;
  const effective = nextVote - previous;

  const voteRecord = { ...state.voteRecord, [key]: nextVote as 0 | 1 | -1 };

  if (target === "question") {
    return {
      ...state,
      voteRecord,
      questions: state.questions.map((q) => (q.id === id ? { ...q, votes: q.votes + effective } : q)),
    };
  }

  return {
    ...state,
    voteRecord,
    answers: state.answers.map((a) => (a.id === id ? { ...a, votes: a.votes + effective, updatedAt: nowIso() } : a)),
  };
};

export const validateQuestionDraft = (title: string, content: string, tags: string[]) => {
  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  if (trimmedTitle.length < 1 || trimmedTitle.length > 200) return false;
  if (!trimmedContent) return false;
  if (tags.length < 1 || tags.length > 5) return false;
  return true;
};

const sortQuestions = (questions: Question[]) =>
  [...questions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

export const qaReducer = (state: QAState, action: QAAction): QAState => {
  switch (action.type) {
    case "ADD_QUESTION": {
      const { title, content, tags } = action.payload;
      if (!validateQuestionDraft(title, content, tags)) {
        return state;
      }
      const now = nowIso();
      const questionId = `q${state.idCounters.question}`;
      const nextQuestion: Question = {
        id: questionId,
        title: title.trim(),
        content: content.trim(),
        authorId: state.currentUserId,
        tags,
        views: 0,
        votes: 0,
        answers: 0,
        createdAt: now,
        updatedAt: now,
      };
      return {
        ...state,
        questions: sortQuestions([nextQuestion, ...state.questions]),
        idCounters: { ...state.idCounters, question: state.idCounters.question + 1 },
      };
    }
    case "ADD_ANSWER": {
      const { questionId, content } = action.payload;
      const cleanContent = content.trim();
      if (!cleanContent) return state;
      const now = nowIso();
      const answerId = `ans${state.idCounters.answer}`;
      const nextState: QAState = {
        ...state,
        answers: [
          {
            id: answerId,
            questionId,
            authorId: state.currentUserId,
            content: cleanContent,
            votes: 0,
            isAccepted: false,
            createdAt: now,
            updatedAt: now,
          },
          ...state.answers,
        ],
        follows: state.follows.map((f) =>
          f.questionId === questionId ? { ...f, hasNewAnswers: true } : f,
        ),
        idCounters: { ...state.idCounters, answer: state.idCounters.answer + 1 },
      };
      return updateQuestionAnswerCount(nextState, questionId);
    }
    case "TOGGLE_VOTE":
      return applyVote(state, action.payload.target, action.payload.id, action.payload.delta);
    case "ACCEPT_ANSWER": {
      const answer = state.answers.find((a) => a.id === action.payload.answerId);
      if (!answer) return state;
      return {
        ...state,
        answers: state.answers.map((a) =>
          a.questionId !== answer.questionId ? a : { ...a, isAccepted: a.id === answer.id, updatedAt: nowIso() },
        ),
      };
    }
    case "TOGGLE_FOLLOW_QUESTION": {
      const existing = state.follows.find((f) => f.questionId === action.payload.questionId);
      if (existing) {
        return { ...state, follows: state.follows.filter((f) => f.questionId !== action.payload.questionId) };
      }
      return {
        ...state,
        follows: [
          {
            questionId: action.payload.questionId,
            followedAt: nowIso(),
            hasNewAnswers: false,
          },
          ...state.follows,
        ],
      };
    }
    case "MARK_QUESTION_VIEWED":
      return {
        ...state,
        questions: state.questions.map((q) =>
          q.id === action.payload.questionId ? { ...q, views: q.views + 1, updatedAt: nowIso() } : q,
        ),
      };
    case "MARK_FOLLOW_SEEN":
      return {
        ...state,
        follows: state.follows.map((f) =>
          f.questionId === action.payload.questionId ? { ...f, hasNewAnswers: false } : f,
        ),
      };
    default:
      return state;
  }
};