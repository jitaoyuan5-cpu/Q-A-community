import { Router } from "express";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const onlyNew = req.query.onlyNew === "1";
    const [rows] = await pool.query(
      `SELECT f.question_id, f.has_new_answers, f.followed_at,
              q.title, q.votes, q.views, q.answers_count, q.updated_at,
              u.id AS author_id, u.name AS author_name, u.avatar AS author_avatar,
              GROUP_CONCAT(DISTINCT t.name) AS tag_names
       FROM follows f
       JOIN questions q ON q.id = f.question_id
       JOIN users u ON u.id = q.author_id
       LEFT JOIN question_tags qt ON qt.question_id = q.id
       LEFT JOIN tags t ON t.id = qt.tag_id
       WHERE f.user_id = ? AND q.is_hidden = 0 ${onlyNew ? "AND f.has_new_answers = 1" : ""}
       GROUP BY f.id, q.id, u.id
       ORDER BY f.has_new_answers DESC, q.updated_at DESC`,
      [req.user.userId],
    );
    res.json(
      rows.map((row) => ({
        questionId: row.question_id,
        title: row.title,
        votes: row.votes,
        views: row.views,
        answers: row.answers_count,
        updatedAt: row.updated_at,
        hasNewAnswers: Boolean(row.has_new_answers),
        tags: row.tag_names ? row.tag_names.split(",") : [],
        author: { id: row.author_id, name: row.author_name, avatar: row.author_avatar },
      })),
    );
  }),
);

router.post(
  "/toggle/:questionId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const questionId = Number(req.params.questionId);
    const [questionRows] = await pool.query("SELECT id FROM questions WHERE id = ? AND is_hidden = 0 LIMIT 1", [questionId]);
    if (!questionRows.length) return res.status(404).json({ message: "Question not found" });
    const [rows] = await pool.query("SELECT id FROM follows WHERE user_id = ? AND question_id = ? LIMIT 1", [req.user.userId, questionId]);
    if (rows.length) {
      await pool.query("DELETE FROM follows WHERE id = ?", [rows[0].id]);
      return res.json({ followed: false });
    }
    await pool.query("INSERT INTO follows (user_id, question_id, has_new_answers) VALUES (?, ?, 0)", [req.user.userId, questionId]);
    return res.json({ followed: true });
  }),
);

router.post(
  "/seen/:questionId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const questionId = Number(req.params.questionId);
    await pool.query("UPDATE follows SET has_new_answers = 0 WHERE user_id = ? AND question_id = ?", [req.user.userId, questionId]);
    res.json({ success: true });
  }),
);

export default router;
