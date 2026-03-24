export type LocaleCode = "zh-CN" | "en-US";

export interface User {
  id: string;
  name: string;
  avatar: string;
  reputation: number;
  role?: "user" | "admin";
  preferredLocale?: LocaleCode;
  bio?: string;
  location?: string;
  website?: string;
}

export interface Question {
  id: string;
  title: string;
  content: string;
  authorId: string;
  tags: string[];
  views: number;
  votes: number;
  answers: number;
  createdAt: string;
  updatedAt: string;
  isFavorited?: boolean;
}

export interface Answer {
  id: string;
  questionId: string;
  authorId: string;
  content: string;
  votes: number;
  isAccepted: boolean;
  createdAt: string;
  updatedAt: string;
  isHidden?: boolean;
}

export interface Topic {
  id: string;
  title: string;
  description: string;
  category: string;
  trend: number;
  posts: number;
  views: number;
}

export interface RemoteJob {
  id: string;
  title: string;
  company: string;
  location: string;
  region: string;
  salaryMin: number;
  salaryMax: number;
  type: "全职" | "兼职";
  skills: string[];
  postedAt: string;
}

export interface Article {
  id: string;
  title: string;
  excerpt: string;
  content?: string;
  authorId: string;
  cover: string;
  tags: string[];
  views: number;
  likes: number;
  comments: number;
  publishedAt: string;
  isFavorited?: boolean;
}

export interface FollowRecord {
  questionId: string;
  followedAt: string;
  hasNewAnswers: boolean;
}

export interface FavoriteRecord {
  id: string;
  targetType: "question" | "article" | "tutorial";
  targetId: string;
  title: string;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  type: "new_answer" | "new_comment" | "answer_accepted" | "follow_update";
  targetType: "question" | "answer" | "comment";
  targetId: string;
  title: string;
  body: string;
  link: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string | null;
  actor?: {
    id: string;
    name: string;
    avatar: string;
  } | null;
}

export interface EmailPreference {
  emailEnabled: boolean;
  notifyNewAnswer: boolean;
  notifyNewComment: boolean;
  notifyAnswerAccepted: boolean;
  notifyFollowUpdate: boolean;
}

export interface UploadAsset {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}

export interface ReportRecord {
  id: string;
  targetType: "question" | "answer" | "article" | "comment" | "chat_message";
  targetId: string;
  reason: string;
  detail?: string;
  status: "pending" | "reviewed" | "rejected";
  actionTaken?: "ignore" | "hide" | "delete" | null;
  reviewNote?: string;
  createdAt: string;
}

export interface AssistantCitation {
  targetType: "question" | "article" | "answer";
  targetId: number;
  title: string;
  excerpt: string;
  link: string;
}

export interface AssistantReplyMeta {
  provider: "local" | "openai";
  degraded: boolean;
  reason?: string | null;
}

export interface AssistantMessage {
  id: number;
  role: "system" | "user" | "assistant";
  content: string;
  createdAt?: string;
  citations?: AssistantCitation[];
  meta?: AssistantReplyMeta;
}

export interface AssistantThread {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: string;
  messages?: AssistantMessage[];
}

export interface QuestionChatMessage {
  id: number;
  questionId: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: number;
    name: string;
    avatar: string;
  };
}

export interface TutorialLesson {
  id: number;
  title: string;
  description: string;
  sortOrder: number;
  videoProvider: "youtube" | "bilibili" | "vimeo";
  videoUrl: string;
  embedUrl: string;
  durationSeconds: number;
  starterTemplate?: "html" | "typescript" | "react" | null;
  starterFiles?: Record<string, string> | null;
}

export interface Tutorial {
  id: number;
  title: string;
  summary: string;
  description: string;
  cover: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  tags: string[];
  lessonCount?: number;
  isFavorited?: boolean;
  progressPercent?: number;
  lastLessonId?: number | null;
  createdAt: string;
  updatedAt: string;
  author: {
    id: number;
    name: string;
    avatar: string;
  };
  lessons?: TutorialLesson[];
}

export interface PlaygroundTemplate {
  key: "html" | "typescript" | "react";
  label: string;
  files: Record<string, string>;
}

export interface PlaygroundShare {
  id: number;
  title: string;
  templateKey: PlaygroundTemplate["key"];
  files: Record<string, string>;
  createdAt: string;
}

export interface DeveloperApiKey {
  id: number;
  name: string;
  keyPrefix: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
}

export interface VoteRecord {
  [key: string]: -1 | 0 | 1;
}

export interface QAState {
  users: User[];
  currentUserId: string;
  questions: Question[];
  answers: Answer[];
  topics: Topic[];
  remoteJobs: RemoteJob[];
  articles: Article[];
  follows: FollowRecord[];
  favorites: FavoriteRecord[];
  notifications: NotificationRecord[];
  emailPreferences: EmailPreference;
  voteRecord: VoteRecord;
  idCounters: {
    question: number;
    answer: number;
  };
}
