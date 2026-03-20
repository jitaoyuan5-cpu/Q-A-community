import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

const router = Router();

const toggleSchema = z.object({
  targetType: z.enum(["question", "article"]),
  targetId: z.number().int().positive(),
});

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT f.id, f.target_type, f.target_id, f.created_at,
              q.title AS question_title,
              a.title AS article_title
       FROM favorites f
       LEFT JOIN questions q ON f.target_type = 'question' AND q.id = f.target_id AND q.is_hidden = 0
       LEFT JOIN articles a ON f.target_type = 'article' AND a.id = f.target_id AND a.is_hidden = 0
       WHERE f.user_id = ?
         AND (
           (f.target_type = 'question' AND q.id IS NOT NULL)
           OR (f.target_type = 'article' AND a.id IS NOT NULL)
         )
       ORDER BY f.created_at DESC`,
      [req.user.userId],
    );

    res.json(
      rows.map((row) => ({
        id: row.id,
        targetType: row.target_type,
        targetId: row.target_id,
        title: row.question_title || row.article_title || "",
        createdAt: row.created_at,
      })),
    );
  }),
);

router.post(
  "/toggle",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = toggleSchema.parse(req.body);
    const table = payload.targetType === "question" ? "questions" : "articles";
    const [targetRows] = await pool.query(`SELECT id FROM ${table} WHERE id = ? AND is_hidden = 0 LIMIT 1`, [payload.targetId]);
    if (!targetRows.length) return res.status(404).json({ message: "Target not found" });

    const [rows] = await pool.query(
      "SELECT id FROM favorites WHERE user_id = ? AND target_type = ? AND target_id = ? LIMIT 1",
      [req.user.userId, payload.targetType, payload.targetId],
    );
    if (rows.length) {
      await pool.query("DELETE FROM favorites WHERE id = ?", [rows[0].id]);
      return res.json({ favorited: false });
    }

    await pool.query("INSERT INTO favorites (user_id, target_type, target_id) VALUES (?, ?, ?)", [
      req.user.userId,
      payload.targetType,
      payload.targetId,
    ]);
    res.status(201).json({ favorited: true });
  }),
);

export default router;
