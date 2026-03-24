import { pool } from "../db/pool.js";
import { env } from "../config/env.js";
import { normalizeLocale } from "./locale.js";

const assistantStopTerms = new Set(["如何", "什么", "为什么", "怎么", "可以", "一下", "一个", "一些", "是否", "以及", "这个", "那个"]);

const toCitation = (row, targetType) => ({
  targetType,
  targetId: row.id,
  title: row.title,
  excerpt: row.excerpt,
  link: targetType === "article" ? `/articles/${row.id}` : `/question/${row.question_id || row.id}`,
});

const extractAssistantTerms = (query) => {
  const source = String(query || "").trim();
  const terms = [];
  const seen = new Set();

  const addTerm = (value) => {
    const term = String(value || "").trim();
    if (!term) return;
    if (assistantStopTerms.has(term)) return;
    if (seen.has(term)) return;
    seen.add(term);
    terms.push(term);
  };

  for (const token of source.match(/[A-Za-z][A-Za-z0-9.+#-]{1,}/g) || []) {
    addTerm(token);
  }

  for (const block of source.match(/[\u4e00-\u9fff]{2,}/g) || []) {
    if (block.length <= 4) {
      addTerm(block);
      continue;
    }
    for (let index = 0; index < block.length - 1 && terms.length < 8; index += 1) {
      addTerm(block.slice(index, index + 2));
    }
  }

  if (!terms.length && source) {
    addTerm(source.slice(0, 24));
  }

  return terms.slice(0, 8);
};

const buildLikeWhere = (fields, terms) => {
  const clauses = [];
  const params = [];

  for (const term of terms) {
    for (const field of fields) {
      clauses.push(`${field} LIKE ?`);
      params.push(`%${term}%`);
    }
  }

  return {
    sql: clauses.length ? clauses.join(" OR ") : "1 = 0",
    params,
  };
};

export const searchAssistantSources = async (query) => {
  const terms = extractAssistantTerms(query);
  if (!terms.length) return [];

  const questionWhere = buildLikeWhere(["title", "content"], terms);
  const articleWhere = buildLikeWhere(["title", "excerpt", "content"], terms);
  const answerWhere = buildLikeWhere(["a.content", "q.title"], terms);

  const [questions] = await pool.query(
    `SELECT id, title, LEFT(content, 180) AS excerpt, votes, views
     FROM questions
     WHERE is_hidden = 0 AND (${questionWhere.sql})
     ORDER BY votes DESC, views DESC
     LIMIT 4`,
    questionWhere.params,
  );
  const [articles] = await pool.query(
    `SELECT id, title, LEFT(COALESCE(excerpt, content), 180) AS excerpt, views, likes
     FROM articles
     WHERE is_hidden = 0 AND (${articleWhere.sql})
     ORDER BY views DESC, likes DESC
     LIMIT 3`,
    articleWhere.params,
  );
  const [answers] = await pool.query(
    `SELECT a.id, a.question_id, q.title, LEFT(a.content, 180) AS excerpt, a.votes
     FROM answers a
     JOIN questions q ON q.id = a.question_id
     WHERE a.is_hidden = 0 AND q.is_hidden = 0 AND (${answerWhere.sql})
     ORDER BY a.votes DESC, a.created_at DESC
     LIMIT 3`,
    answerWhere.params,
  );

  return [
    ...questions.map((row) => toCitation(row, "question")),
    ...articles.map((row) => toCitation(row, "article")),
    ...answers.map((row) => toCitation(row, "answer")),
  ];
};

const buildLocalCompletion = ({ locale, query, citations }) => {
  const isEnglish = normalizeLocale(locale) === "en-US";
  if (!citations.length) {
    return isEnglish
      ? `I did not find a strong site match for "${query}" yet, but you can still start with this triage:\n\n1. Clarify the exact goal, current behavior, and expected behavior.\n2. Add the framework version, concrete error message, and the smallest reproducible snippet.\n3. If this is an architecture choice, list the state shape, update frequency, and where side effects happen.\n4. If you want, I can turn your current description into a sharper troubleshooting checklist or a better question draft.`
      : `我暂时没有检索到和“${query}”高度匹配的站内讨论，但可以先按这个思路快速拆解：\n\n1. 先明确目标：现在的实际行为、期望行为、差异点分别是什么。\n2. 补关键上下文：框架版本、报错原文、最小复现代码、你已经尝试过的方法。\n3. 如果这是方案选择题，先列出状态结构、更新频率、是否有副作用，再判断该用哪种模式。\n4. 如果你愿意，我可以继续把你当前描述整理成“排查清单”或“更容易得到回答的提问文案”。`;
  }

  const lead = isEnglish
    ? `I found several relevant items in the community for "${query}". Start with these sources:`
    : `我在社区内容里找到了几条和“${query}”最相关的资料，可以先从这些来源开始：`;
  const bullets = citations
    .slice(0, 4)
    .map((item, index) => `${index + 1}. **${item.title}**\n   - ${item.excerpt}`)
    .join("\n");
  const followUp = isEnglish
    ? "\n\nIf you want, I can continue and help compare tradeoffs, summarize the linked discussions, or turn the result into an action checklist."
    : "\n\n如果你愿意，我可以继续帮你比较方案取舍、总结这些讨论，或者把结论整理成可执行清单。";
  return `${lead}\n\n${bullets}${followUp}`;
};

const buildPrompt = ({ query, citations, history, locale }) => {
  const sourceText = citations
    .slice(0, 6)
    .map((item, index) => `[${index + 1}] ${item.title}\n${item.excerpt}\nLink: ${item.link}`)
    .join("\n\n");
  const priorTurns = history
    .slice(-6)
    .map((item) => `${item.role === "user" ? "User" : "Assistant"}: ${item.content}`)
    .join("\n");

  return [
    normalizeLocale(locale) === "en-US"
      ? "You are the QA Community assistant. Answer using the site content first. Cite source numbers when relevant."
      : "你是问答社区 AI 助手。优先根据站内内容回答，并在合适时引用来源编号。",
    priorTurns,
    `User question: ${query}`,
    `Sources:\n${sourceText}`,
  ]
    .filter(Boolean)
    .join("\n\n");
};

const callOpenAiCompatible = async ({ query, citations, history, locale }) => {
  if (!env.aiApiKey) return { ok: false, reason: "missing_api_key" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.aiTimeoutMs);

  try {
    const response = await fetch(`${env.aiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.aiApiKey}`,
      },
      body: JSON.stringify({
        model: env.aiModel,
        messages: [{ role: "user", content: buildPrompt({ query, citations, history, locale }) }],
        temperature: 0.2,
      }),
      signal: controller.signal,
    }).catch((error) => {
      if (error?.name === "AbortError") {
        return { aborted: true };
      }
      return null;
    });

    if (response?.aborted) return { ok: false, reason: "timeout" };
    if (!response?.ok) return { ok: false, reason: "provider_error" };

    const body = await response.json().catch(() => null);
    const content = body?.choices?.[0]?.message?.content;
    if (!content) return { ok: false, reason: "empty_response" };
    return { ok: true, content };
  } finally {
    clearTimeout(timeout);
  }
};

export const generateAssistantReply = async ({ query, citations, history = [], locale = "zh-CN" }) => {
  const fallbackContent = buildLocalCompletion({ locale, query, citations });

  if (env.aiRemoteEnabled) {
    const live = await callOpenAiCompatible({ query, citations, history, locale });
    if (live.ok) {
      return {
        content: live.content,
        provider: env.aiProvider,
        degraded: false,
        reason: null,
      };
    }
    return {
      content: fallbackContent,
      provider: "local",
      degraded: true,
      reason: live.reason,
    };
  }
  return {
    content: fallbackContent,
    provider: "local",
    degraded: false,
    reason: null,
  };
};
