import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";
import { generateAssistantReply, searchAssistantSources } from "../utils/assistant.js";
import { getUserLocale } from "../utils/locale.js";
import { parseJsonField } from "../utils/json.js";

const router = Router();

const querySchema = z.object({
  threadId: z.number().int().positive().optional(),
  query: z.string().min(1).max(1000),
});

router.use(requireAuth);

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

router.post(
  "/query",
  asyncHandler(async (req, res) => {
    const payload = querySchema.parse(req.body);
    const locale = await getUserLocale(pool, req.user.userId);

    let threadId = payload.threadId;
    if (threadId) {
      const [owned] = await pool.query("SELECT id FROM assistant_threads WHERE id = ? AND user_id = ? LIMIT 1", [threadId, req.user.userId]);
      if (!owned.length) return res.status(404).json({ message: "Thread not found" });
    } else {
      const [result] = await pool.query("INSERT INTO assistant_threads (user_id, title) VALUES (?, ?)", [req.user.userId, payload.query.slice(0, 80)]);
      threadId = result.insertId;
    }

    await pool.query("INSERT INTO assistant_messages (thread_id, role, content) VALUES (?, 'user', ?)", [threadId, payload.query.trim()]);
    const [historyRows] = await pool.query("SELECT role, content FROM assistant_messages WHERE thread_id = ? ORDER BY created_at ASC", [threadId]);

    const citations = await searchAssistantSources(payload.query);
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
