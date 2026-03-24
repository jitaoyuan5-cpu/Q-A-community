import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

const router = Router();

const createSchema = z.object({
  targetType: z.enum(["question", "answer", "article", "comment", "chat_message"]),
  targetId: z.number().int().positive(),
  reason: z.enum(["垃圾内容", "广告营销", "攻击辱骂", "色情低俗", "侵权抄袭", "其他"]),
  detail: z.string().max(1000).optional().default(""),
});

const tableByType = {
  question: "questions",
  answer: "answers",
  article: "articles",
  comment: "comments",
  chat_message: "question_chat_messages",
};

router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = createSchema.parse(req.body);
    const table = tableByType[payload.targetType];
    const [targetRows] = await pool.query(`SELECT id FROM ${table} WHERE id = ? LIMIT 1`, [payload.targetId]);
    if (!targetRows.length) return res.status(404).json({ message: "Target not found" });

    const [existingRows] = await pool.query(
      `SELECT id FROM reports
       WHERE reporter_id = ? AND target_type = ? AND target_id = ? AND status = 'pending'
       LIMIT 1`,
      [req.user.userId, payload.targetType, payload.targetId],
    );
    if (existingRows.length) return res.status(409).json({ message: "Duplicate pending report" });

    const [result] = await pool.query(
      `INSERT INTO reports (reporter_id, target_type, target_id, reason, detail)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.userId, payload.targetType, payload.targetId, payload.reason, payload.detail.trim()],
    );
    res.status(201).json({ id: result.insertId });
  }),
);

export default router;
