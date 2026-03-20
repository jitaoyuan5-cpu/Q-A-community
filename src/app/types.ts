export interface User {
  id: string;
  name: string;
  avatar: string;
  reputation: number;
  role?: "user" | "admin";
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
  targetType: "question" | "article";
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
  targetType: "question" | "answer" | "article" | "comment";
  targetId: string;
  reason: string;
  detail?: string;
  status: "pending" | "reviewed" | "rejected";
  actionTaken?: "ignore" | "hide" | "delete" | null;
  reviewNote?: string;
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
