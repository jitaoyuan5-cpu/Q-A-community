import { Router } from "express";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../utils/http.js";
import { authOptional } from "../middleware/auth.js";
import { parseJsonField } from "../utils/json.js";

const router = Router();

router.get(
  "/topics",
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query("SELECT id, title, description, category, trend, posts, views FROM topics ORDER BY trend DESC, views DESC");
    res.json(rows);
  }),
);

router.get(
  "/jobs",
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query(
      "SELECT id, title, company, location, region, salary_min, salary_max, type, skills, posted_at FROM remote_jobs ORDER BY posted_at DESC",
    );
    res.json(rows.map((row) => ({ ...row, skills: parseJsonField(row.skills, []) })));
  }),
);

router.get(
  "/articles",
  authOptional,
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query(
      `SELECT a.id, a.title, a.excerpt, a.content, a.cover, a.views, a.likes, a.comments_count, a.published_at,
              u.id AS author_id, u.name AS author_name, u.avatar AS author_avatar,
              GROUP_CONCAT(DISTINCT t.name) AS tag_names,
              ${_req.user ? "MAX(CASE WHEN f.id IS NULL THEN 0 ELSE 1 END) AS is_favorited" : "0 AS is_favorited"}
       FROM articles a
       JOIN users u ON u.id = a.author_id
       LEFT JOIN article_tags at ON at.article_id = a.id
       LEFT JOIN tags t ON t.id = at.tag_id
       ${_req.user ? "LEFT JOIN favorites f ON f.target_type = 'article' AND f.target_id = a.id AND f.user_id = ?" : ""}
       WHERE a.is_hidden = 0
       GROUP BY a.id, u.id
       ORDER BY a.published_at DESC`,
      _req.user ? [_req.user.userId] : [],
    );
    res.json(
      rows.map((row) => ({
        id: row.id,
        title: row.title,
        excerpt: row.excerpt,
        content: row.content,
        cover: row.cover,
        views: row.views,
        likes: row.likes,
        comments: row.comments_count,
        publishedAt: row.published_at,
        tags: row.tag_names ? row.tag_names.split(",") : [],
        isFavorited: Boolean(row.is_favorited),
        author: { id: row.author_id, name: row.author_name, avatar: row.author_avatar },
      })),
    );
  }),
);

router.get(
  "/tags",
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query("SELECT id, name FROM tags ORDER BY name ASC");
    res.json(rows);
  }),
);

export default router;
