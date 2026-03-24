import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";
import { broadcastQuestionChatMessage, getOnlineCount } from "../realtime/question-chat.js";

const router = Router();

const createSchema = z.object({
  content: z.string().min(1).max(2000),
});

const loadMessages = async (questionId) => {
  const [rows] = await pool.query(
    `SELECT m.id, m.question_id, m.content, m.created_at, m.updated_at, m.user_id,
            u.name AS author_name, u.avatar AS author_avatar
     FROM question_chat_messages m
     JOIN users u ON u.id = m.user_id
     WHERE m.question_id = ? AND m.is_hidden = 0
     ORDER BY m.created_at DESC
     LIMIT 50`,
    [questionId],
  );
  return rows
    .reverse()
    .map((row) => ({
      id: row.id,
      questionId: row.question_id,
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      author: {
        id: row.user_id,
        name: row.author_name,
        avatar: row.author_avatar,
      },
    }));
};

router.get(
  "/:questionId/messages",
  asyncHandler(async (req, res) => {
    const questionId = Number(req.params.questionId);
    const [questionRows] = await pool.query("SELECT id FROM questions WHERE id = ? AND is_hidden = 0 LIMIT 1", [questionId]);
    if (!questionRows.length) return res.status(404).json({ message: "Question not found" });
    const items = await loadMessages(questionId);
    res.json({ items, onlineCount: getOnlineCount(questionId) });
  }),
);

router.post(
  "/:questionId/messages",
  requireAuth,
  asyncHandler(async (req, res) => {
    const questionId = Number(req.params.questionId);
    const payload = createSchema.parse(req.body);
    const [questionRows] = await pool.query("SELECT id FROM questions WHERE id = ? AND is_hidden = 0 LIMIT 1", [questionId]);
    if (!questionRows.length) return res.status(404).json({ message: "Question not found" });

    const [result] = await pool.query("INSERT INTO question_chat_messages (question_id, user_id, content) VALUES (?, ?, ?)", [
      questionId,
      req.user.userId,
      payload.content.trim(),
    ]);
    await broadcastQuestionChatMessage(questionId, result.insertId);
    const items = await loadMessages(questionId);
    res.status(201).json({ items, onlineCount: getOnlineCount(questionId), messageId: result.insertId });
  }),
);

export default router;
