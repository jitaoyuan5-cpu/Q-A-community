import { Router } from "express";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../utils/http.js";
import { authOptional, requireAuth } from "../middleware/auth.js";

const router = Router();

router.get(
  "/",
  authOptional,
  asyncHandler(async (req, res) => {
    const tab = req.query.tab || "newest";
    const q = (req.query.q || "").toString().trim();
    const tags = (req.query.tags || "").toString().split(",").filter(Boolean);

    let orderBy = "q.created_at DESC";
    if (tab === "hot") orderBy = "q.votes DESC, q.views DESC";
    if (tab === "unanswered") orderBy = "q.answers_count ASC, q.created_at DESC";

    const args = [];
    const where = [];
    if (q) {
      where.push("(q.title LIKE ? OR q.content LIKE ?)");
      args.push(`%${q}%`, `%${q}%`);
    }
    where.push("q.is_hidden = 0");
    if (tab === "unanswered") {
      where.push("q.answers_count = 0");
    }
    if (tags.length) {
      where.push(`q.id IN (
        SELECT qt.question_id FROM question_tags qt
        JOIN tags t ON t.id = qt.tag_id
        WHERE t.name IN (${tags.map(() => "?").join(",")})
        GROUP BY qt.question_id
        HAVING COUNT(DISTINCT t.name) = ?
      )`);
      args.push(...tags, tags.length);
    }

    const sql = `
      SELECT q.id, q.title, q.content, q.views, q.votes, q.answers_count, q.created_at, q.updated_at,
             u.id AS author_id, u.name AS author_name, u.avatar AS author_avatar, u.reputation AS author_reputation,
             GROUP_CONCAT(DISTINCT t.name) AS tag_names,
             ${req.user ? "MAX(CASE WHEN f.user_id IS NULL THEN 0 ELSE 1 END) AS is_followed" : "0 AS is_followed"},
             ${req.user ? "MAX(CASE WHEN fav.id IS NULL THEN 0 ELSE 1 END) AS is_favorited" : "0 AS is_favorited"}
      FROM questions q
      JOIN users u ON u.id = q.author_id
      LEFT JOIN question_tags qt ON qt.question_id = q.id
      LEFT JOIN tags t ON t.id = qt.tag_id
      ${req.user ? "LEFT JOIN follows f ON f.question_id = q.id AND f.user_id = ?" : ""}
      ${req.user ? "LEFT JOIN favorites fav ON fav.target_type = 'question' AND fav.target_id = q.id AND fav.user_id = ?" : ""}
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      GROUP BY q.id, u.id
      ORDER BY ${orderBy}
      LIMIT 100
    `;

    const queryArgs = req.user ? [req.user.userId, req.user.userId, ...args] : args;
    const [rows] = await pool.query(sql, queryArgs);

    res.json(
      rows.map((row) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        views: row.views,
        votes: row.votes,
        answers: row.answers_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isFollowed: Boolean(row.is_followed),
        isFavorited: Boolean(row.is_favorited),
        author: {
          id: row.author_id,
          name: row.author_name,
          avatar: row.author_avatar,
          reputation: row.author_reputation,
        },
        tags: row.tag_names ? row.tag_names.split(",") : [],
      })),
    );
  }),
);

router.get(
  "/:id",
  authOptional,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const trackView = req.query.trackView !== "0";
    if (trackView) {
      await pool.query("UPDATE questions SET views = views + 1 WHERE id = ?", [id]);
    }

    const [questions] = await pool.query(
      `SELECT q.id, q.title, q.content, q.views, q.votes, q.answers_count, q.created_at, q.updated_at,
              u.id AS author_id, u.name AS author_name, u.avatar AS author_avatar, u.reputation AS author_reputation,
              GROUP_CONCAT(DISTINCT t.name) AS tag_names,
              ${req.user ? "MAX(CASE WHEN f.user_id IS NULL THEN 0 ELSE 1 END) AS is_followed" : "0 AS is_followed"},
              ${req.user ? "MAX(CASE WHEN fav.id IS NULL THEN 0 ELSE 1 END) AS is_favorited" : "0 AS is_favorited"}
       FROM questions q
       JOIN users u ON u.id = q.author_id
       LEFT JOIN question_tags qt ON qt.question_id = q.id
       LEFT JOIN tags t ON t.id = qt.tag_id
       ${req.user ? "LEFT JOIN follows f ON f.question_id = q.id AND f.user_id = ?" : ""}
       ${req.user ? "LEFT JOIN favorites fav ON fav.target_type = 'question' AND fav.target_id = q.id AND fav.user_id = ?" : ""}
       WHERE q.id = ? AND q.is_hidden = 0
       GROUP BY q.id, u.id`,
      req.user ? [req.user.userId, req.user.userId, id] : [id],
    );

    if (!questions.length) return res.status(404).json({ message: "Question not found" });

    const [answers] = await pool.query(
      `SELECT a.id, a.question_id, a.content, a.votes, a.is_accepted, a.created_at, a.updated_at,
              u.id AS author_id, u.name AS author_name, u.avatar AS author_avatar, u.reputation AS author_reputation
       FROM answers a
       JOIN users u ON u.id = a.author_id
       WHERE a.question_id = ? AND a.is_hidden = 0
       ORDER BY a.is_accepted DESC, a.votes DESC, a.created_at DESC`,
      [id],
    );

    res.json({
      question: {
        id: questions[0].id,
        title: questions[0].title,
        content: questions[0].content,
        views: questions[0].views,
        votes: questions[0].votes,
        answers: questions[0].answers_count,
        createdAt: questions[0].created_at,
        updatedAt: questions[0].updated_at,
        isFollowed: Boolean(questions[0].is_followed),
        isFavorited: Boolean(questions[0].is_favorited),
        author: {
          id: questions[0].author_id,
          name: questions[0].author_name,
          avatar: questions[0].author_avatar,
          reputation: questions[0].author_reputation,
        },
        tags: questions[0].tag_names ? questions[0].tag_names.split(",") : [],
      },
      answers: answers.map((row) => ({
        id: row.id,
        questionId: row.question_id,
        content: row.content,
        votes: row.votes,
        isAccepted: Boolean(row.is_accepted),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        author: {
          id: row.author_id,
          name: row.author_name,
          avatar: row.author_avatar,
          reputation: row.author_reputation,
        },
      })),
    });
  }),
);

router.post(
  "/:id/vote",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const value = Number(req.body.value);
    if (![1, -1].includes(value)) return res.status(400).json({ message: "Invalid vote" });

    const [targetRows] = await pool.query("SELECT id FROM questions WHERE id = ?", [id]);
    if (!targetRows.length) return res.status(404).json({ message: "Question not found" });

    const [voteRows] = await pool.query(
      "SELECT id, value FROM votes WHERE user_id = ? AND target_type = 'question' AND target_id = ? LIMIT 1",
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
      await pool.query("INSERT INTO votes (user_id, target_type, target_id, value) VALUES (?, 'question', ?, ?)", [req.user.userId, id, value]);
    }

    if (delta !== 0) {
      await pool.query("UPDATE questions SET votes = votes + ? WHERE id = ?", [delta, id]);
    }
    res.json({ success: true });
  }),
);

router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { title, content, tags } = req.body;
    const cleanTags = Array.isArray(tags) ? tags.map((item) => String(item).trim()).filter(Boolean).slice(0, 5) : [];
    if (!title?.trim() || title.trim().length > 200 || !content?.trim() || cleanTags.length < 1) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    const [result] = await pool.query(
      "INSERT INTO questions (title, content, author_id) VALUES (?, ?, ?)",
      [title.trim(), content.trim(), req.user.userId],
    );
    const questionId = result.insertId;

    for (const tagName of cleanTags) {
      await pool.query("INSERT INTO tags (name) VALUES (?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)", [tagName]);
      const [tagRows] = await pool.query("SELECT LAST_INSERT_ID() as id");
      await pool.query("INSERT IGNORE INTO question_tags (question_id, tag_id) VALUES (?, ?)", [questionId, tagRows[0].id]);
    }

    res.status(201).json({ id: questionId });
  }),
);

export default router;
