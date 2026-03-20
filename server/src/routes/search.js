import { Router } from "express";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../utils/http.js";
import { authOptional, requireAuth } from "../middleware/auth.js";

const router = Router();

router.get(
  "/",
  authOptional,
  asyncHandler(async (req, res) => {
    const query = String(req.query.q || "").trim();
    const types = String(req.query.types || "questions,articles,users").split(",");
    if (!query) return res.json({ questions: [], articles: [], users: [] });

    const result = { questions: [], articles: [], users: [] };

    if (types.includes("questions")) {
      const [rows] = await pool.query(
        "SELECT id, title, content, votes, views FROM questions WHERE is_hidden = 0 AND (title LIKE ? OR content LIKE ?) ORDER BY votes DESC, views DESC LIMIT 10",
        [`%${query}%`, `%${query}%`],
      );
      result.questions = rows;
    }

    if (types.includes("articles")) {
      const [rows] = await pool.query(
        "SELECT id, title, excerpt, views, likes, comments_count FROM articles WHERE is_hidden = 0 AND (title LIKE ? OR excerpt LIKE ?) ORDER BY views DESC LIMIT 10",
        [`%${query}%`, `%${query}%`],
      );
      result.articles = rows;
    }

    if (types.includes("users")) {
      const [rows] = await pool.query(
        "SELECT id, name, avatar, reputation FROM users WHERE name LIKE ? ORDER BY reputation DESC LIMIT 10",
        [`%${query}%`],
      );
      result.users = rows;
    }

    if (req.user) {
      await pool.query("INSERT INTO search_history (user_id, query_text) VALUES (?, ?)", [req.user.userId, query]);
    }

    res.json(result);
  }),
);

router.get(
  "/suggest",
  asyncHandler(async (req, res) => {
    const query = String(req.query.q || "").trim();
    if (!query) return res.json([]);

    const [qRows] = await pool.query("SELECT title AS value, 'question' AS type FROM questions WHERE is_hidden = 0 AND title LIKE ? LIMIT 5", [`%${query}%`]);
    const [tRows] = await pool.query("SELECT name AS value, 'tag' AS type FROM tags WHERE name LIKE ? LIMIT 5", [`%${query}%`]);
    const [uRows] = await pool.query("SELECT name AS value, 'user' AS type FROM users WHERE name LIKE ? LIMIT 5", [`%${query}%`]);
    res.json([...qRows, ...tRows, ...uRows].slice(0, 12));
  }),
);

router.get(
  "/history",
  requireAuth,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      "SELECT id, query_text, created_at FROM search_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
      [req.user.userId],
    );
    res.json(rows);
  }),
);

router.delete(
  "/history/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await pool.query("DELETE FROM search_history WHERE id = ? AND user_id = ?", [id, req.user.userId]);
    res.json({ success: true });
  }),
);

export default router;
