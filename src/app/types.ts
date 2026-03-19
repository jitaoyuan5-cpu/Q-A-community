export interface User {
  id: string;
  name: string;
  avatar: string;
  reputation: number;
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
}

export interface FollowRecord {
  questionId: string;
  followedAt: string;
  hasNewAnswers: boolean;
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
  voteRecord: VoteRecord;
  idCounters: {
    question: number;
    answer: number;
  };
}
