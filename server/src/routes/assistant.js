import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../utils/http.js";
import { ApiError } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";
import { generateAssistantReply, searchAssistantSources, streamAssistantReply } from "../utils/assistant.js";
import { getUserLocale } from "../utils/locale.js";
import { parseJsonField } from "../utils/json.js";

const router = Router();
const refTypeSchema = z.enum(["question", "article", "answer", "comment"]);
const contextRefSchema = z.object({
  targetType: refTypeSchema,
  targetId: z.number().int().positive(),
});

const querySchema = z.object({
  threadId: z.number().int().positive().optional(),
  query: z.string().min(1).max(1000),
  contextRefs: z.array(contextRefSchema).max(8).optional(),
});

router.use(requireAuth);

const toCitationKey = (item) => `${item.targetType}:${item.targetId}`;

const mergeCitations = (...groups) => {
  const items = [];
  const seen = new Set();

  for (const group of groups) {
    for (const item of group || []) {
      const key = toCitationKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }

  return items;
};

const resolveAssistantContextRefs = async (refs = []) => {
  if (!refs.length) return [];

  const questionIds = refs.filter((item) => item.targetType === "question").map((item) => item.targetId);
  const articleIds = refs.filter((item) => item.targetType === "article").map((item) => item.targetId);
  const answerIds = refs.filter((item) => item.targetType === "answer").map((item) => item.targetId);
  const commentIds = refs.filter((item) => item.targetType === "comment").map((item) => item.targetId);
  const citations = [];

  if (questionIds.length) {
    const [rows] = await pool.query(
      `SELECT id, title, LEFT(content, 180) AS excerpt
       FROM questions
       WHERE is_hidden = 0 AND id IN (${questionIds.map(() => "?").join(",")})`,
      questionIds,
    );
    citations.push(
      ...rows.map((row) => ({
        targetType: "question",
        targetId: row.id,
        title: row.title,
        excerpt: row.excerpt,
        link: `/question/${row.id}`,
      })),
    );
  }

  if (articleIds.length) {
    const [rows] = await pool.query(
      `SELECT id, title, LEFT(COALESCE(excerpt, content), 180) AS excerpt
       FROM articles
       WHERE is_hidden = 0 AND id IN (${articleIds.map(() => "?").join(",")})`,
      articleIds,
    );
    citations.push(
      ...rows.map((row) => ({
        targetType: "article",
        targetId: row.id,
        title: row.title,
        excerpt: row.excerpt,
        link: `/articles/${row.id}`,
      })),
    );
  }

  if (answerIds.length) {
    const [rows] = await pool.query(
      `SELECT a.id, a.question_id, LEFT(a.content, 180) AS excerpt, q.title
       FROM answers a
       JOIN questions q ON q.id = a.question_id
       WHERE a.is_hidden = 0 AND q.is_hidden = 0 AND a.id IN (${answerIds.map(() => "?").join(",")})`,
      answerIds,
    );
    citations.push(
      ...rows.map((row) => ({
        targetType: "answer",
        targetId: row.id,
        title: `回答 · ${row.title}`,
        excerpt: row.excerpt,
        link: `/question/${row.question_id}#answer-${row.id}`,
      })),
    );
  }

  if (commentIds.length) {
    const [rows] = await pool.query(
      `SELECT c.id,
              LEFT(c.content, 180) AS excerpt,
              COALESCE(q_direct.id, q_from_answer.id) AS question_id,
              COALESCE(q_direct.title, q_from_answer.title) AS question_title
       FROM comments c
       LEFT JOIN questions q_direct ON c.target_type = 'question' AND q_direct.id = c.target_id
       LEFT JOIN answers a ON c.target_type = 'answer' AND a.id = c.target_id
       LEFT JOIN questions q_from_answer ON a.question_id = q_from_answer.id
       WHERE c.is_hidden = 0
         AND c.id IN (${commentIds.map(() => "?").join(",")})
         AND (
           (c.target_type = 'question' AND q_direct.is_hidden = 0)
           OR
           (c.target_type = 'answer' AND a.is_hidden = 0 AND q_from_answer.is_hidden = 0)
         )`,
      commentIds,
    );
    citations.push(
      ...rows.map((row) => ({
        targetType: "comment",
        targetId: row.id,
        title: `评论 · ${row.question_title}`,
        excerpt: row.excerpt,
        link: `/question/${row.question_id}#comment-${row.id}`,
      })),
    );
  }

  return mergeCitations(citations);
};

const prepareAssistantTurn = async (userId, payload) => {
  const locale = await getUserLocale(pool, userId);

  let threadId = payload.threadId;
  if (threadId) {
    const [owned] = await pool.query("SELECT id FROM assistant_threads WHERE id = ? AND user_id = ? LIMIT 1", [threadId, userId]);
    if (!owned.length) {
      throw new ApiError(404, "Thread not found");
    }
  } else {
    const [result] = await pool.query("INSERT INTO assistant_threads (user_id, title) VALUES (?, ?)", [userId, payload.query.slice(0, 80)]);
    threadId = result.insertId;
  }

  await pool.query("INSERT INTO assistant_messages (thread_id, role, content) VALUES (?, 'user', ?)", [threadId, payload.query.trim()]);
  const [historyRows] = await pool.query("SELECT role, content FROM assistant_messages WHERE thread_id = ? ORDER BY created_at ASC", [threadId]);
  const explicitCitations = await resolveAssistantContextRefs(payload.contextRefs || []);
  const searchCitations = await searchAssistantSources(payload.query);
  const citations = mergeCitations(explicitCitations, searchCitations);

  return {
    locale,
    threadId,
    historyRows,
    citations,
  };
};

router.get(
  "/references",
  asyncHandler(async (req, res) => {
    const query = String(req.query.q || "").trim();
    if (!query) return res.json([]);

    const [questions] = await pool.query(
      `SELECT id, title, LEFT(content, 140) AS excerpt
       FROM questions
       WHERE is_hidden = 0 AND (title LIKE ? OR content LIKE ?)
       ORDER BY votes DESC, views DESC
       LIMIT 4`,
      [`%${query}%`, `%${query}%`],
    );
    const [articles] = await pool.query(
      `SELECT id, title, LEFT(COALESCE(excerpt, content), 140) AS excerpt
       FROM articles
       WHERE is_hidden = 0 AND (title LIKE ? OR excerpt LIKE ? OR content LIKE ?)
       ORDER BY views DESC, likes DESC
       LIMIT 4`,
      [`%${query}%`, `%${query}%`, `%${query}%`],
    );
    const [answers] = await pool.query(
      `SELECT a.id, a.question_id, LEFT(a.content, 140) AS excerpt, q.title
       FROM answers a
       JOIN questions q ON q.id = a.question_id
       WHERE a.is_hidden = 0 AND q.is_hidden = 0 AND (a.content LIKE ? OR q.title LIKE ?)
       ORDER BY a.votes DESC, a.created_at DESC
       LIMIT 4`,
      [`%${query}%`, `%${query}%`],
    );
    const [comments] = await pool.query(
      `SELECT c.id,
              LEFT(c.content, 140) AS excerpt,
              COALESCE(q_direct.id, q_from_answer.id) AS question_id,
              COALESCE(q_direct.title, q_from_answer.title) AS question_title
       FROM comments c
       LEFT JOIN questions q_direct ON c.target_type = 'question' AND q_direct.id = c.target_id
       LEFT JOIN answers a ON c.target_type = 'answer' AND a.id = c.target_id
       LEFT JOIN questions q_from_answer ON a.question_id = q_from_answer.id
       WHERE c.is_hidden = 0
         AND (c.content LIKE ? OR COALESCE(q_direct.title, q_from_answer.title) LIKE ?)
         AND (
           (c.target_type = 'question' AND q_direct.is_hidden = 0)
           OR
           (c.target_type = 'answer' AND a.is_hidden = 0 AND q_from_answer.is_hidden = 0)
         )
       ORDER BY c.created_at DESC
       LIMIT 4`,
      [`%${query}%`, `%${query}%`],
    );

    res.json(
      mergeCitations(
        questions.map((row) => ({
          targetType: "question",
          targetId: row.id,
          title: row.title,
          excerpt: row.excerpt,
          link: `/question/${row.id}`,
        })),
        articles.map((row) => ({
          targetType: "article",
          targetId: row.id,
          title: row.title,
          excerpt: row.excerpt,
          link: `/articles/${row.id}`,
        })),
        answers.map((row) => ({
          targetType: "answer",
          targetId: row.id,
          title: `回答 · ${row.title}`,
          excerpt: row.excerpt,
          link: `/question/${row.question_id}#answer-${row.id}`,
        })),
        comments.map((row) => ({
          targetType: "comment",
          targetId: row.id,
          title: `评论 · ${row.question_title}`,
          excerpt: row.excerpt,
          link: `/question/${row.question_id}#comment-${row.id}`,
        })),
      ),
    );
  }),
);

router.get(
  "/threads",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT t.id, t.title, t.created_at, t.updated_at,
              (SELECT content FROM assistant_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_message
       FROM assistant_threads t
       WHERE t.user_id = ?
       ORDER BY t.updated_at DESC`,
      [req.user.userId],
    );
    res.json(
      rows.map((row) => ({
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastMessage: row.last_message || "",
      })),
    );
  }),
);

router.get(
  "/threads/:id",
  asyncHandler(async (req, res) => {
    const threadId = Number(req.params.id);
    const [threadRows] = await pool.query("SELECT id, title, created_at, updated_at FROM assistant_threads WHERE id = ? AND user_id = ? LIMIT 1", [threadId, req.user.userId]);
    if (!threadRows.length) return res.status(404).json({ message: "Thread not found" });

    const [messageRows] = await pool.query(
      "SELECT id, role, content, citations_json, created_at FROM assistant_messages WHERE thread_id = ? ORDER BY created_at ASC",
      [threadId],
    );
    res.json({
      id: threadRows[0].id,
      title: threadRows[0].title,
      createdAt: threadRows[0].created_at,
      updatedAt: threadRows[0].updated_at,
      messages: messageRows.map((row) => ({
        id: row.id,
        role: row.role,
        content: row.content,
        createdAt: row.created_at,
        citations: parseJsonField(row.citations_json, []),
      })),
    });
  }),
);

router.delete(
  "/threads/:id",
  asyncHandler(async (req, res) => {
    const threadId = Number(req.params.id);
    const [rows] = await pool.query("SELECT id FROM assistant_threads WHERE id = ? AND user_id = ? LIMIT 1", [threadId, req.user.userId]);
    if (!rows.length) return res.status(404).json({ message: "Thread not found" });

    await pool.query("DELETE FROM assistant_threads WHERE id = ? AND user_id = ?", [threadId, req.user.userId]);
    res.json({ success: true });
  }),
);

router.post("/query/stream", async (req, res, next) => {
  let streamOpened = false;
  const sendEvent = (event, payload) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const payload = querySchema.parse(req.body);
    const { locale, threadId, historyRows, citations } = await prepareAssistantTurn(req.user.userId, payload);

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    streamOpened = true;

    sendEvent("thread", { threadId });

    const assistantResult = await streamAssistantReply({
      query: payload.query,
      citations,
      history: historyRows,
      locale,
      onChunk: async (chunk) => {
        sendEvent("delta", { content: chunk });
      },
    });

    const [messageResult] = await pool.query(
      "INSERT INTO assistant_messages (thread_id, role, content, citations_json) VALUES (?, 'assistant', ?, ?)",
      [threadId, assistantResult.content, JSON.stringify(citations)],
    );
    await pool.query("UPDATE assistant_threads SET updated_at = NOW() WHERE id = ?", [threadId]);

    sendEvent("done", {
      threadId,
      message: {
        id: messageResult.insertId,
        role: "assistant",
        content: assistantResult.content,
        citations,
        meta: {
          provider: assistantResult.provider,
          degraded: assistantResult.degraded,
          reason: assistantResult.reason,
        },
      },
    });
    res.end();
  } catch (error) {
    if (!streamOpened) {
      next(error);
      return;
    }
    sendEvent("error", { message: error instanceof Error ? error.message : "Stream failed" });
    res.end();
  }
});

router.post(
  "/query",
  asyncHandler(async (req, res) => {
    const payload = querySchema.parse(req.body);
    const { locale, threadId, historyRows, citations } = await prepareAssistantTurn(req.user.userId, payload);
    const assistantResult = await generateAssistantReply({
      query: payload.query,
      citations,
      history: historyRows,
      locale,
    });
    const [messageResult] = await pool.query(
      "INSERT INTO assistant_messages (thread_id, role, content, citations_json) VALUES (?, 'assistant', ?, ?)",
      [threadId, assistantResult.content, JSON.stringify(citations)],
    );
    await pool.query("UPDATE assistant_threads SET updated_at = NOW() WHERE id = ?", [threadId]);

    res.status(201).json({
      threadId,
      message: {
        id: messageResult.insertId,
        role: "assistant",
        content: assistantResult.content,
        citations,
        meta: {
          provider: assistantResult.provider,
          degraded: assistantResult.degraded,
          reason: assistantResult.reason,
        },
      },
    });
  }),
);

export default router;
