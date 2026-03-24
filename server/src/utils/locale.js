import { pool } from "../db/pool.js";

export const supportedLocales = ["zh-CN", "en-US"];

export const normalizeLocale = (value) => (supportedLocales.includes(value) ? value : "zh-CN");

export const getUserLocale = async (conn, userId) => {
  if (!userId) return "zh-CN";
  const [rows] = await conn.query("SELECT preferred_locale FROM users WHERE id = ? LIMIT 1", [userId]);
  return normalizeLocale(rows[0]?.preferred_locale);
};

const textTemplates = {
  "zh-CN": {
    notifications: {
      questionAnsweredTitle: "你的问题收到了新回答",
      followedQuestionUpdatedTitle: "你关注的问题有新动态",
      questionCommentTitle: "你的问题收到了新评论",
      answerCommentTitle: "你的回答收到了新评论",
      answerAcceptedTitle: "你的回答被采纳了",
    },
    emails: {
      questionAnsweredSubject: "问答社区：你的问题收到了新回答",
      questionAnsweredText: "问题《{title}》有新的回答，访问 {link} 查看。",
      followedQuestionUpdatedSubject: "问答社区：关注的问题有新动态",
      followedQuestionUpdatedText: "你关注的问题《{title}》有新的回答，访问 {link} 查看。",
      questionCommentSubject: "问答社区：你的问题收到了新评论",
      questionCommentText: "问题《{title}》收到了新评论，访问 {link} 查看。",
      answerCommentSubject: "问答社区：你的回答收到了新评论",
      answerCommentText: "你在《{title}》下的回答收到了新评论，访问 {link} 查看。",
      answerAcceptedSubject: "问答社区：你的回答被采纳了",
      answerAcceptedText: "你在《{title}》下的回答已被采纳，访问 {link} 查看。",
    },
  },
  "en-US": {
    notifications: {
      questionAnsweredTitle: "Your question has a new answer",
      followedQuestionUpdatedTitle: "A followed question has new activity",
      questionCommentTitle: "Your question has a new comment",
      answerCommentTitle: "Your answer has a new comment",
      answerAcceptedTitle: "Your answer was accepted",
    },
    emails: {
      questionAnsweredSubject: "QA Community: your question has a new answer",
      questionAnsweredText: 'Your question "{title}" has a new answer. Visit {link} to review it.',
      followedQuestionUpdatedSubject: "QA Community: followed question updated",
      followedQuestionUpdatedText: 'A question you follow, "{title}", has a new answer. Visit {link} to review it.',
      questionCommentSubject: "QA Community: your question has a new comment",
      questionCommentText: 'Your question "{title}" has a new comment. Visit {link} to review it.',
      answerCommentSubject: "QA Community: your answer has a new comment",
      answerCommentText: 'Your answer under "{title}" has a new comment. Visit {link} to review it.',
      answerAcceptedSubject: "QA Community: your answer was accepted",
      answerAcceptedText: 'Your answer under "{title}" was accepted. Visit {link} to review it.',
    },
  },
};

const interpolate = (template, params) =>
  template.replace(/\{(\w+)\}/g, (_match, key) => String(params[key] ?? ""));

export const tSystem = (locale, bucket, key, params = {}) => {
  const safeLocale = normalizeLocale(locale);
  const template = textTemplates[safeLocale]?.[bucket]?.[key] ?? textTemplates["zh-CN"]?.[bucket]?.[key] ?? key;
  return interpolate(template, params);
};

export const getCurrentUserLocale = async (userId) => {
  if (!userId) return "zh-CN";
  return getUserLocale(pool, userId);
};
