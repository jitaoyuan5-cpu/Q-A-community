import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import { getDbConfig } from "./db-config.js";

const users = [
  ["alice@example.com", "123456", "张三", "https://i.pravatar.cc/80?img=1", 2850, "admin"],
  ["bob@example.com", "123456", "李四", "https://i.pravatar.cc/80?img=2", 1920, "user"],
  ["carol@example.com", "123456", "王五", "https://i.pravatar.cc/80?img=3", 4100, "user"],
];

const questions = [
  ["React 中 useState 和 useReducer 的区别是什么？", "我想知道什么时候应该使用 `useReducer`。\n\n```tsx\nconst [count, setCount] = useState(0)\n```\n", 1, 1245, 15, 1],
  ["如何优化 Next.js 应用的首屏加载速度？", "已尝试懒加载和代码分割，是否还要检查 `next/font` 和缓存头？", 2, 892, 22, 1],
  ["TypeScript 中 interface 和 type 有什么区别？", "想了解二者在扩展性、联合类型和声明合并上的核心差异。", 3, 2103, 31, 0],
];

const tags = ["React", "JavaScript", "TypeScript", "Next.js", "性能优化", "Hooks"];

export const seedDatabase = async (conn) => {
  await conn.query("SET FOREIGN_KEY_CHECKS=0");
  await conn.query("TRUNCATE TABLE notifications; TRUNCATE TABLE reports; TRUNCATE TABLE favorites; TRUNCATE TABLE uploads; TRUNCATE TABLE user_notification_preferences; TRUNCATE TABLE votes; TRUNCATE TABLE follows; TRUNCATE TABLE comments; TRUNCATE TABLE answers; TRUNCATE TABLE question_tags; TRUNCATE TABLE questions; TRUNCATE TABLE article_tags; TRUNCATE TABLE articles; TRUNCATE TABLE tags; TRUNCATE TABLE search_history; TRUNCATE TABLE auth_tokens; TRUNCATE TABLE remote_jobs; TRUNCATE TABLE topics; TRUNCATE TABLE users;");
  await conn.query("SET FOREIGN_KEY_CHECKS=1");

  for (const [email, password, name, avatar, reputation, role] of users) {
    const passwordHash = await bcrypt.hash(password, 10);
    await conn.query("INSERT INTO users (email, password_hash, name, avatar, reputation, role) VALUES (?, ?, ?, ?, ?, ?)", [email, passwordHash, name, avatar, reputation, role]);
  }

  for (const name of tags) {
    await conn.query("INSERT INTO tags (name) VALUES (?)", [name]);
  }

  for (const [title, content, authorId, views, votes, answersCount] of questions) {
    await conn.query("INSERT INTO questions (title, content, author_id, views, votes, answers_count) VALUES (?, ?, ?, ?, ?, ?)", [title, content, authorId, views, votes, answersCount]);
  }

  await conn.query("INSERT INTO question_tags (question_id, tag_id) VALUES (1,1),(1,2),(1,6),(2,1),(2,4),(2,5),(3,2),(3,3)");
  await conn.query("INSERT INTO answers (question_id, author_id, content, votes, is_accepted) VALUES (1,3,'`useState` 适合简单状态，`useReducer` 适合复杂状态转移。',23,1),(2,1,'从关键渲染路径、缓存策略和字体资源加载顺序入手。',15,1)");
  await conn.query("INSERT INTO follows (user_id, question_id, has_new_answers) VALUES (1,1,1)");
  await conn.query("INSERT INTO topics (title,description,category,trend,posts,views) VALUES ('AI 编程助手对开发者的影响','讨论 AI 工具如何改变开发流程。','AI',25,156,12400),('2026 年前端框架趋势','React、Vue、Svelte 取舍。','前端',18,89,8900)");
  await conn.query("INSERT INTO remote_jobs (title,company,location,region,salary_min,salary_max,type,skills) VALUES ('高级前端工程师','科技创新公司','远程 - 中国','中国',25,40,'全职',JSON_ARRAY('React','TypeScript','Next.js')),('后端开发工程师','云计算平台','远程 - 全球','全球',30,50,'全职',JSON_ARRAY('Node.js','Go','微服务'))");
  await conn.query("INSERT INTO articles (title,excerpt,content,author_id,cover,views,likes,comments_count) VALUES ('深入理解 React Server Components','从渲染边界理解 RSC。','# React Server Components\\n\\n```tsx\\nexport default async function Page() {}\\n```\\n\\n从渲染边界理解 RSC。',1,'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&h=400&fit=crop',3456,128,45),('TypeScript 类型体操实战','结合业务讲解高级类型。','## TypeScript 类型体操\\n\\n通过条件类型和模板字面量类型解决复杂约束。',2,'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=800&h=400&fit=crop',2890,95,32)");
  await conn.query("INSERT INTO article_tags (article_id, tag_id) VALUES (1,1),(2,3)");
  await conn.query("INSERT INTO user_notification_preferences (user_id, email_enabled, notify_new_answer, notify_new_comment, notify_answer_accepted, notify_follow_update) VALUES (1,1,1,1,1,1),(2,1,1,1,1,1),(3,1,1,1,1,1)");
};

export const runSeed = async () => {
  const conn = await mysql.createConnection(getDbConfig());
  try {
    await seedDatabase(conn);
    console.log("seed complete");
  } finally {
    await conn.end();
  }
};
