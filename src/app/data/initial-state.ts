import type { Article, QAState, RemoteJob, Topic, User } from "../types";

const users: User[] = [
  { id: "u1", name: "张三", avatar: "https://i.pravatar.cc/80?img=1", reputation: 2850 },
  { id: "u2", name: "李四", avatar: "https://i.pravatar.cc/80?img=2", reputation: 1920 },
  { id: "u3", name: "王五", avatar: "https://i.pravatar.cc/80?img=3", reputation: 4100 },
  { id: "u4", name: "赵六", avatar: "https://i.pravatar.cc/80?img=4", reputation: 890 },
  { id: "u5", name: "钱七", avatar: "https://i.pravatar.cc/80?img=5", reputation: 3200 },
];

const topics: Topic[] = [
  { id: "t1", title: "AI 编程助手对开发者的影响", description: "讨论 AI 工具如何改变开发流程与岗位分工。", category: "AI", trend: 25, posts: 156, views: 12400 },
  { id: "t2", title: "2026 年前端框架趋势", description: "React、Vue、Svelte 在生产场景中的取舍。", category: "前端", trend: 18, posts: 89, views: 8900 },
  { id: "t3", title: "远程工作最佳实践", description: "异步协作、工程规范与团队沟通方式。", category: "职业", trend: 32, posts: 234, views: 15600 },
  { id: "t4", title: "TypeScript 高级技巧", description: "复杂类型系统、推断与工程化实践。", category: "TypeScript", trend: 15, posts: 178, views: 11200 },
];

const remoteJobs: RemoteJob[] = [
  { id: "j1", title: "高级前端工程师", company: "科技创新公司", location: "远程 - 中国", region: "中国", salaryMin: 25, salaryMax: 40, type: "全职", skills: ["React", "TypeScript", "Next.js"], postedAt: "2026-03-16T09:00:00.000Z" },
  { id: "j2", title: "后端开发工程师", company: "云计算平台", location: "远程 - 全球", region: "全球", salaryMin: 30, salaryMax: 50, type: "全职", skills: ["Node.js", "Go", "微服务"], postedAt: "2026-03-11T08:00:00.000Z" },
  { id: "j3", title: "UI/UX 设计师", company: "设计工作室", location: "远程 - 亚太", region: "亚太", salaryMin: 20, salaryMax: 35, type: "兼职", skills: ["Figma", "用户体验", "界面设计"], postedAt: "2026-03-15T12:00:00.000Z" },
  { id: "j4", title: "全栈工程师", company: "初创公司", location: "远程 - 不限", region: "不限", salaryMin: 28, salaryMax: 45, type: "全职", skills: ["Python", "React", "AWS"], postedAt: "2026-03-13T10:00:00.000Z" },
];

const articles: Article[] = [
  { id: "a1", title: "深入理解 React Server Components", excerpt: "从渲染边界、数据获取与性能角度理解 RSC 在生产中的价值。", content: "从组件边界、数据获取策略到性能权衡，拆解 React Server Components 在真实项目中的定位与成本。", authorId: "u2", cover: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&h=400&fit=crop", tags: ["React", "前端"], views: 3456, likes: 128, comments: 45, publishedAt: "2026-03-15T10:00:00.000Z" },
  { id: "a2", title: "TypeScript 类型体操实战", excerpt: "结合业务案例讲解条件类型、模板类型和类型推断技巧。", content: "结合真实业务例子，拆解条件类型、模板字面量类型和类型推断在复杂前端工程中的用法。", authorId: "u3", cover: "https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=800&h=400&fit=crop", tags: ["TypeScript", "教程"], views: 2890, likes: 95, comments: 32, publishedAt: "2026-03-14T14:30:00.000Z" },
  { id: "a3", title: "微服务架构设计最佳实践", excerpt: "服务拆分、通信协议与数据一致性在大型系统中的落地方式。", content: "从拆分边界、同步异步通信到数据一致性策略，梳理一套可落地的微服务设计方法。", authorId: "u5", cover: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&h=400&fit=crop", tags: ["架构", "后端"], views: 4123, likes: 167, comments: 58, publishedAt: "2026-03-13T09:15:00.000Z" },
];

export const createInitialState = (): QAState => ({
  users,
  currentUserId: "u1",
  questions: [
    { id: "q1", title: "React 中 useState 和 useReducer 的区别是什么？", content: "我在学习 React Hooks，想知道什么时候应该使用 useState，什么时候应该使用 useReducer？", authorId: "u1", tags: ["React", "JavaScript", "Hooks"], views: 1245, votes: 15, answers: 3, createdAt: "2026-03-17T10:30:00.000Z", updatedAt: "2026-03-17T10:30:00.000Z" },
    { id: "q2", title: "如何优化 Next.js 应用的首屏加载速度？", content: "我的 Next.js 应用首屏加载较慢，已尝试图片懒加载和代码分割。", authorId: "u2", tags: ["Next.js", "性能优化", "React"], views: 892, votes: 22, answers: 1, createdAt: "2026-03-17T14:20:00.000Z", updatedAt: "2026-03-17T14:20:00.000Z" },
    { id: "q3", title: "TypeScript 中 interface 和 type 有什么区别？", content: "定义类型时应该使用 interface 还是 type？它们的关键差异是什么？", authorId: "u3", tags: ["TypeScript", "JavaScript"], views: 2103, votes: 31, answers: 0, createdAt: "2026-03-16T09:15:00.000Z", updatedAt: "2026-03-16T09:15:00.000Z" },
    { id: "q4", title: "如何在 Tailwind CSS 中实现暗色模式？", content: "项目想加暗色模式切换，Tailwind CSS 推荐怎么做？", authorId: "u4", tags: ["Tailwind CSS", "CSS", "暗色模式"], views: 567, votes: 8, answers: 0, createdAt: "2026-03-17T16:45:00.000Z", updatedAt: "2026-03-17T16:45:00.000Z" },
  ],
  answers: [
    { id: "ans1", questionId: "q1", authorId: "u3", content: "useState 适合简单状态；useReducer 适合复杂状态逻辑与状态转换。", votes: 23, isAccepted: true, createdAt: "2026-03-17T11:15:00.000Z", updatedAt: "2026-03-17T11:15:00.000Z" },
    { id: "ans2", questionId: "q1", authorId: "u5", content: "补充一点，useReducer 配合 TypeScript 时 action 类型可约束更好。", votes: 8, isAccepted: false, createdAt: "2026-03-17T12:30:00.000Z", updatedAt: "2026-03-17T12:30:00.000Z" },
    { id: "ans3", questionId: "q2", authorId: "u4", content: "可从关键渲染路径、缓存策略、next/font 和资源加载顺序入手。", votes: 15, isAccepted: true, createdAt: "2026-03-17T15:00:00.000Z", updatedAt: "2026-03-17T15:00:00.000Z" },
  ],
  topics,
  remoteJobs,
  articles,
  follows: [{ questionId: "q1", followedAt: "2026-03-17T10:00:00.000Z", hasNewAnswers: true }],
  favorites: [
    { id: "fav1", targetType: "question", targetId: "q1", title: "React 中 useState 和 useReducer 的区别是什么？", createdAt: "2026-03-17T10:05:00.000Z" },
    { id: "fav2", targetType: "article", targetId: "a1", title: "深入理解 React Server Components", createdAt: "2026-03-17T10:06:00.000Z" },
  ],
  notifications: [
    { id: "n1", type: "new_answer", targetType: "question", targetId: "q1", title: "你的问题收到了新回答", body: "React 中 useState 和 useReducer 的区别是什么？", link: "/question/q1", isRead: false, createdAt: "2026-03-17T11:20:00.000Z", actor: { id: "u3", name: "王五", avatar: "https://i.pravatar.cc/80?img=3" } },
  ],
  emailPreferences: {
    emailEnabled: true,
    notifyNewAnswer: true,
    notifyNewComment: true,
    notifyAnswerAccepted: true,
    notifyFollowUpdate: true,
  },
  voteRecord: {},
  idCounters: {
    question: 5,
    answer: 4,
  },
});
