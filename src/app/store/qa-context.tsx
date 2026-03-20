import { createContext, useContext, useEffect, useMemo, useReducer, useState } from "react";
import { createInitialState } from "../data/initial-state";
import { apiRequest } from "../api/client";
import { useAuth } from "../auth-context";
import { qaReducer } from "./qa-reducer";
import type {
  Answer,
  Article,
  FavoriteRecord,
  NotificationRecord,
  QAState,
  Question,
  RemoteJob,
  Topic,
  User,
} from "../types";

type QAActions = {
  addQuestion: (title: string, content: string, tags: string[]) => Promise<string | null>;
  addAnswer: (questionId: string, content: string) => Promise<void>;
  voteQuestion: (questionId: string, delta: 1 | -1) => Promise<void>;
  voteAnswer: (answerId: string, delta: 1 | -1) => Promise<void>;
  acceptAnswer: (answerId: string) => Promise<void>;
  toggleFollowQuestion: (questionId: string) => Promise<void>;
  toggleFavorite: (targetType: "question" | "article", targetId: string) => Promise<void>;
  markQuestionViewed: (questionId: string) => Promise<void>;
  markFollowSeen: (questionId: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
};

const QAContext = createContext<{ state: QAState; actions: QAActions } | null>(null);

const createApiInitialState = (): QAState => {
  const base = createInitialState();
  return {
    ...base,
    users: [],
    questions: [],
    answers: [],
    topics: [],
    remoteJobs: [],
    articles: [],
    follows: [],
    favorites: [],
    notifications: [],
    voteRecord: {},
    idCounters: { question: 1, answer: 1 },
  };
};

const upsertUsers = (users: User[], incoming: User[]): User[] => {
  const map = new Map(users.map((u) => [u.id, u]));
  for (const item of incoming) map.set(item.id, { ...map.get(item.id), ...item });
  return [...map.values()];
};

const mapQuestion = (row: any): Question => ({
  id: String(row.id),
  title: row.title,
  content: row.content,
  authorId: String(row.author?.id ?? row.author_id),
  tags: row.tags ?? [],
  views: row.views ?? 0,
  votes: row.votes ?? 0,
  answers: row.answers ?? row.answers_count ?? 0,
  createdAt: row.createdAt ?? row.created_at,
  updatedAt: row.updatedAt ?? row.updated_at,
  isFavorited: Boolean(row.isFavorited ?? row.is_favorited),
});

const mapAnswer = (row: any): Answer => ({
  id: String(row.id),
  questionId: String(row.questionId ?? row.question_id),
  authorId: String(row.author?.id ?? row.author_id),
  content: row.content,
  votes: row.votes ?? 0,
  isAccepted: Boolean(row.isAccepted ?? row.is_accepted),
  createdAt: row.createdAt ?? row.created_at,
  updatedAt: row.updatedAt ?? row.updated_at,
});

const mapFavorite = (row: any): FavoriteRecord => ({
  id: String(row.id),
  targetType: row.targetType ?? row.target_type,
  targetId: String(row.targetId ?? row.target_id),
  title: row.title,
  createdAt: row.createdAt ?? row.created_at,
});

const mapNotification = (row: any): NotificationRecord => ({
  id: String(row.id),
  type: row.type,
  targetType: row.targetType ?? row.target_type,
  targetId: String(row.targetId ?? row.target_id),
  title: row.title,
  body: row.body || "",
  link: row.link,
  isRead: Boolean(row.isRead ?? row.is_read),
  createdAt: row.createdAt ?? row.created_at,
  readAt: row.readAt ?? row.read_at ?? null,
  actor: row.actor
    ? {
        id: String(row.actor.id),
        name: row.actor.name,
        avatar: row.actor.avatar,
      }
    : null,
});

function TestQAProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(qaReducer, undefined, createInitialState);

  const actions = useMemo<QAActions>(
    () => ({
      addQuestion: async (title, content, tags) => {
        const before = state.idCounters.question;
        dispatch({ type: "ADD_QUESTION", payload: { title, content, tags } });
        const changed = title.trim().length > 0 && title.trim().length <= 200 && content.trim().length > 0 && tags.length > 0 && tags.length <= 5;
        return changed ? `q${before}` : null;
      },
      addAnswer: async (questionId, content) => dispatch({ type: "ADD_ANSWER", payload: { questionId, content } }),
      voteQuestion: async (questionId, delta) => dispatch({ type: "TOGGLE_VOTE", payload: { target: "question", id: questionId, delta } }),
      voteAnswer: async (answerId, delta) => dispatch({ type: "TOGGLE_VOTE", payload: { target: "answer", id: answerId, delta } }),
      acceptAnswer: async (answerId) => dispatch({ type: "ACCEPT_ANSWER", payload: { answerId } }),
      toggleFollowQuestion: async (questionId) => dispatch({ type: "TOGGLE_FOLLOW_QUESTION", payload: { questionId } }),
      toggleFavorite: async () => undefined,
      markQuestionViewed: async (questionId) => dispatch({ type: "MARK_QUESTION_VIEWED", payload: { questionId } }),
      markFollowSeen: async (questionId) => dispatch({ type: "MARK_FOLLOW_SEEN", payload: { questionId } }),
      refreshAll: async () => undefined,
      refreshNotifications: async () => undefined,
    }),
    [state.idCounters.question],
  );

  return <QAContext.Provider value={{ state, actions }}>{children}</QAContext.Provider>;
}

function ApiQAProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<QAState>(() => ({
    ...createApiInitialState(),
    currentUserId: user ? String(user.id) : "",
  }));

  const refreshNotifications = async () => {
    if (!user) {
      setState((prev) => ({ ...prev, notifications: [] }));
      return;
    }
    const notificationRes = await apiRequest<{ unreadCount: number; items: any[] }>("/notifications").catch(() => ({ unreadCount: 0, items: [] }));
    setState((prev) => ({ ...prev, notifications: notificationRes.items.map(mapNotification) }));
  };

  const refreshAll = async () => {
    const [questionsRows, topicsRows, jobsRows, articlesRows, tagsRows, favoritesRows, followsRows, notificationRes] = await Promise.all([
      apiRequest<any[]>("/questions?tab=newest").catch(() => []),
      apiRequest<any[]>("/meta/topics").catch(() => []),
      apiRequest<any[]>("/meta/jobs").catch(() => []),
      apiRequest<any[]>("/meta/articles").catch(() => []),
      apiRequest<any[]>("/meta/tags").catch(() => []),
      user ? apiRequest<any[]>("/favorites").catch(() => []) : Promise.resolve([]),
      user ? apiRequest<any[]>("/follows").catch(() => []) : Promise.resolve([]),
      user ? apiRequest<{ unreadCount: number; items: any[] }>("/notifications").catch(() => ({ unreadCount: 0, items: [] })) : Promise.resolve({ unreadCount: 0, items: [] }),
    ]);

    const usersFromQuestions: User[] = questionsRows.map((q) => ({
      id: String(q.author.id),
      name: q.author.name,
      avatar: q.author.avatar,
      reputation: q.author.reputation,
    }));

    const usersFromArticles: User[] = articlesRows.map((a) => ({
      id: String(a.author.id),
      name: a.author.name,
      avatar: a.author.avatar,
      reputation: 0,
    }));

    const questions = questionsRows.map(mapQuestion);
    const follows = followsRows.map((row) => ({
      questionId: String(row.questionId),
      followedAt: row.updatedAt || new Date().toISOString(),
      hasNewAnswers: Boolean(row.hasNewAnswers),
    }));

    const followQuestions = followsRows.map((row) => ({
      id: String(row.questionId),
      title: row.title,
      content: "",
      authorId: String(row.author.id),
      tags: row.tags || [],
      views: row.views,
      votes: row.votes,
      answers: row.answers,
      createdAt: row.updatedAt,
      updatedAt: row.updatedAt,
      isFavorited: favoritesRows.some((favorite) => favorite.targetType === "question" && String(favorite.targetId) === String(row.questionId)),
    }));

    setState((prev) => {
      const nextQuestions = [...questions, ...followQuestions.filter((fq) => !questions.some((q) => q.id === fq.id))];
      return {
        ...prev,
        users: upsertUsers(
          prev.users,
          [
            ...usersFromQuestions,
            ...usersFromArticles,
            ...(user
              ? [{
                  id: String(user.id),
                  name: user.name,
                  avatar: user.avatar || "",
                  reputation: user.reputation || 0,
                  role: user.role,
                  bio: user.bio,
                  location: user.location,
                  website: user.website,
                }]
              : []),
          ],
        ),
        currentUserId: user ? String(user.id) : "",
        questions: nextQuestions,
        topics: topicsRows.map((row): Topic => ({ id: String(row.id), title: row.title, description: row.description, category: row.category, trend: row.trend, posts: row.posts, views: row.views })),
        remoteJobs: jobsRows.map((row): RemoteJob => ({ id: String(row.id), title: row.title, company: row.company, location: row.location, region: row.region, salaryMin: row.salary_min, salaryMax: row.salary_max, type: row.type, skills: row.skills || [], postedAt: row.posted_at })),
        articles: articlesRows.map((row): Article => ({
          id: String(row.id),
          title: row.title,
          excerpt: row.excerpt,
          content: row.content ?? row.excerpt,
          authorId: String(row.author.id),
          cover: row.cover,
          tags: row.tags || [],
          views: row.views,
          likes: row.likes,
          comments: row.comments,
          publishedAt: row.publishedAt,
          isFavorited: Boolean(row.isFavorited),
        })),
        favorites: favoritesRows.map(mapFavorite),
        follows,
        notifications: notificationRes.items.map(mapNotification),
        answers: prev.answers.filter((answer) => nextQuestions.some((question) => question.id === answer.questionId)),
      };
    });

    if (tagsRows.length) {
      setState((prev) => ({
        ...prev,
        questions: prev.questions.map((q) => ({ ...q, tags: q.tags.length ? q.tags : tagsRows.slice(0, 3).map((t) => t.name) })),
      }));
    }
  };

  useEffect(() => {
    refreshAll().catch(() => undefined);
  }, [user?.id]);

  const syncQuestionDetail = async (questionId: number) => {
    const detail = await apiRequest<any>(`/questions/${questionId}?trackView=0`);
    setState((prev) => ({
      ...prev,
      users: upsertUsers(prev.users, [
        { id: String(detail.question.author.id), name: detail.question.author.name, avatar: detail.question.author.avatar, reputation: detail.question.author.reputation },
        ...detail.answers.map((a: any) => ({ id: String(a.author.id), name: a.author.name, avatar: a.author.avatar, reputation: a.author.reputation })),
      ]),
      questions: prev.questions.some((q) => q.id === String(detail.question.id))
        ? prev.questions.map((q) => (q.id === String(detail.question.id) ? mapQuestion(detail.question) : q))
        : [mapQuestion(detail.question), ...prev.questions],
      answers: [...prev.answers.filter((a) => a.questionId !== String(detail.question.id)), ...detail.answers.map(mapAnswer)],
    }));
  };

  const actions: QAActions = {
    addQuestion: async (title, content, tags) => {
      if (!title.trim() || !content.trim() || tags.length < 1 || tags.length > 5 || title.trim().length > 200) return null;
      const result = await apiRequest<{ id: number }>("/questions", {
        method: "POST",
        body: JSON.stringify({ title, content, tags }),
      });
      await refreshAll();
      return String(result.id);
    },
    addAnswer: async (questionId, content) => {
      const id = Number(questionId.replace(/\D/g, ""));
      if (!id || !content.trim()) return;
      await apiRequest("/answers", {
        method: "POST",
        body: JSON.stringify({ questionId: id, content }),
      });
      await syncQuestionDetail(id);
      await refreshAll();
    },
    voteQuestion: async (questionId, delta) => {
      const id = Number(questionId.replace(/\D/g, ""));
      if (!id) return;
      await apiRequest(`/questions/${id}/vote`, { method: "POST", body: JSON.stringify({ value: delta }) });
      await refreshAll();
    },
    voteAnswer: async (answerId, delta) => {
      const id = Number(answerId.replace(/\D/g, ""));
      if (!id) return;
      await apiRequest(`/answers/${id}/vote`, { method: "POST", body: JSON.stringify({ value: delta }) });
      const answer = state.answers.find((a) => a.id === answerId);
      if (answer) {
        const qid = Number(answer.questionId.replace(/\D/g, ""));
        if (qid) await syncQuestionDetail(qid);
      }
      await refreshAll();
    },
    acceptAnswer: async (answerId) => {
      const id = Number(answerId.replace(/\D/g, ""));
      if (!id) return;
      await apiRequest(`/answers/${id}/accept`, { method: "POST" });
      const answer = state.answers.find((a) => a.id === answerId);
      if (answer) {
        const qid = Number(answer.questionId.replace(/\D/g, ""));
        if (qid) await syncQuestionDetail(qid);
      }
      await refreshAll();
    },
    toggleFollowQuestion: async (questionId) => {
      const id = Number(questionId.replace(/\D/g, ""));
      if (!id) return;
      await apiRequest(`/follows/toggle/${id}`, { method: "POST" });
      await refreshAll();
    },
    toggleFavorite: async (targetType, targetId) => {
      const id = Number(targetId.replace(/\D/g, ""));
      if (!id) return;
      await apiRequest("/favorites/toggle", { method: "POST", body: JSON.stringify({ targetType, targetId: id }) });
      await refreshAll();
    },
    markQuestionViewed: async (questionId) => {
      const id = Number(questionId.replace(/\D/g, ""));
      if (!id) return;
      await apiRequest<any>(`/questions/${id}`).then(async (detail) => {
        setState((prev) => ({
          ...prev,
          users: upsertUsers(prev.users, [
            { id: String(detail.question.author.id), name: detail.question.author.name, avatar: detail.question.author.avatar, reputation: detail.question.author.reputation },
            ...detail.answers.map((a: any) => ({ id: String(a.author.id), name: a.author.name, avatar: a.author.avatar, reputation: a.author.reputation })),
          ]),
          questions: prev.questions.some((q) => q.id === String(detail.question.id))
            ? prev.questions.map((q) => (q.id === String(detail.question.id) ? mapQuestion(detail.question) : q))
            : [mapQuestion(detail.question), ...prev.questions],
          answers: [...prev.answers.filter((a) => a.questionId !== String(detail.question.id)), ...detail.answers.map(mapAnswer)],
        }));
      });
    },
    markFollowSeen: async (questionId) => {
      const id = Number(questionId.replace(/\D/g, ""));
      if (!id) return;
      await apiRequest(`/follows/seen/${id}`, { method: "POST" }).catch(() => undefined);
      setState((prev) => ({ ...prev, follows: prev.follows.map((f) => (f.questionId === questionId ? { ...f, hasNewAnswers: false } : f)) }));
    },
    refreshAll,
    refreshNotifications,
  };

  return <QAContext.Provider value={{ state, actions }}>{children}</QAContext.Provider>;
}

export const QAProvider = ({ children }: { children: React.ReactNode }) => {
  if (import.meta.env.MODE === "test") return <TestQAProvider>{children}</TestQAProvider>;
  return <ApiQAProvider>{children}</ApiQAProvider>;
};

export const useQA = () => {
  const context = useContext(QAContext);
  if (!context) {
    throw new Error("useQA must be used within QAProvider");
  }
  return context;
};
