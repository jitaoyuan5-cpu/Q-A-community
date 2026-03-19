import { Router } from "express";
import { pool, withTx } from "../db/pool.js";
import { asyncHandler } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const questionId = Number(req.body.questionId);
    const content = String(req.body.content || "").trim();
    if (!questionId || !content) return res.status(400).json({ message: "Invalid payload" });

    const [questionRows] = await pool.query("SELECT id FROM questions WHERE id = ? LIMIT 1", [questionId]);
    if (!questionRows.length) return res.status(404).json({ message: "Question not found" });

    const [result] = await pool.query("INSERT INTO answers (question_id, author_id, content) VALUES (?, ?, ?)", [questionId, req.user.userId, content]);
    await pool.query("UPDATE questions SET answers_count = answers_count + 1 WHERE id = ?", [questionId]);
    await pool.query("UPDATE follows SET has_new_answers = 1 WHERE question_id = ?", [questionId]);
    res.status(201).json({ id: result.insertId });
  }),
);

router.post(
  "/:id/vote",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const value = Number(req.body.value);
    if (![1, -1].includes(value)) return res.status(400).json({ message: "Invalid vote" });

    const [targetRows] = await pool.query("SELECT id FROM answers WHERE id = ?", [id]);
    if (!targetRows.length) return res.status(404).json({ message: "Answer not found" });

    const [voteRows] = await pool.query(
      "SELECT id, value FROM votes WHERE user_id = ? AND target_type = 'answer' AND target_id = ? LIMIT 1",
      [req.user.userId, id],
    );

    let delta = value;
    if (voteRows.length) {
      const old = voteRows[0].value;
      const next = old === value ? 0 : value;
      delta = next - old;
      if (next === 0) {
        await pool.query("DELETE FROM votes WHERE id = ?", [voteRows[0].id]);
      } else {
        await pool.query("UPDATE votes SET value = ? WHERE id = ?", [next, voteRows[0].id]);
      }
    } else {
      await pool.query("INSERT INTO votes (user_id, target_type, target_id, value) VALUES (?, 'answer', ?, ?)", [req.user.userId, id, value]);
    }

    if (delta !== 0) {
      await pool.query("UPDATE answers SET votes = votes + ? WHERE id = ?", [delta, id]);
    }
    res.json({ success: true });
  }),
);

router.post(
  "/:id/accept",
  requireAuth,
  asyncHandler(async (req, res) => {
    const answerId = Number(req.params.id);
    await withTx(async (conn) => {
      const [rows] = await conn.query(
        "SELECT a.id, a.question_id, q.author_id FROM answers a JOIN questions q ON q.id = a.question_id WHERE a.id = ? LIMIT 1",
        [answerId],
      );
      if (!rows.length) throw Object.assign(new Error("Answer not found"), { status: 404 });
      if (rows[0].author_id !== req.user.userId) throw Object.assign(new Error("Forbidden"), { status: 403 });

      await conn.query("UPDATE answers SET is_accepted = 0 WHERE question_id = ?", [rows[0].question_id]);
      await conn.query("UPDATE answers SET is_accepted = 1 WHERE id = ?", [answerId]);
    });

    res.json({ success: true });
  }),
);

export default router;
