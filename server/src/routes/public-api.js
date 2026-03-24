import { Router } from "express";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../utils/http.js";
import { sha256 } from "../utils/crypto.js";
import { publicApiLimitPerHour } from "../utils/api-keys.js";

const router = Router();

const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "QA Community Public API",
    version: "v1",
  },
  paths: {
    "/api/public/v1/questions": { get: { summary: "List public questions" } },
    "/api/public/v1/questions/{id}": { get: { summary: "Get public question detail" } },
    "/api/public/v1/answers": { get: { summary: "List answers by questionId" } },
    "/api/public/v1/articles": { get: { summary: "List public articles" } },
    "/api/public/v1/articles/{id}": { get: { summary: "Get public article detail" } },
    "/api/public/v1/tags": { get: { summary: "List tags" } },
    "/api/public/v1/topics": { get: { summary: "List topics" } },
    "/api/public/v1/users/{id}": { get: { summary: "Get public user profile" } },
  },
};

router.get("/openapi.json", (_req, res) => {
  res.json(openApiDocument);
});

const authenticateKey = async (req, res, next) => {
  const rawKey = req.get("x-api-key");
  if (!rawKey) return res.status(401).json({ message: "Missing API key" });

  const [rows] = await pool.query(
    "SELECT id, user_id, revoked_at FROM developer_api_keys WHERE key_hash = ? LIMIT 1",
    [sha256(rawKey)],
  );
  if (!rows.length || rows[0].revoked_at) return res.status(401).json({ message: "Invalid API key" });

  const [countRows] = await pool.query(
    "SELECT COUNT(*) AS count FROM api_usage_logs WHERE api_key_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)",
    [rows[0].id],
  );
  if (Number(countRows[0]?.count || 0) >= publicApiLimitPerHour) {
    return res.status(429).json({ message: "Rate limit exceeded" });
  }

  req.apiKey = { id: rows[0].id, userId: rows[0].user_id };
  res.on("finish", () => {
    pool
      .query("INSERT INTO api_usage_logs (api_key_id, path, method, status_code) VALUES (?, ?, ?, ?)", [rows[0].id, req.path, req.method, res.statusCode])
      .catch(() => undefined);
    pool.query("UPDATE developer_api_keys SET last_used_at = NOW() WHERE id = ?", [rows[0].id]).catch(() => undefined);
  });
  next();
};

router.use(authenticateKey);

router.get(
  "/questions",
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query(
      `SELECT q.id, q.title, q.content, q.votes, q.views, q.answers_count, q.created_at, q.updated_at,
              u.id AS author_id, u.name AS author_name, GROUP_CONCAT(DISTINCT t.name) AS tag_names
       FROM questions q
       JOIN users u ON u.id = q.author_id
       LEFT JOIN question_tags qt ON qt.question_id = q.id
       LEFT JOIN tags t ON t.id = qt.tag_id
       WHERE q.is_hidden = 0
       GROUP BY q.id, u.id
       ORDER BY q.created_at DESC`,
    );
    res.json(
      rows.map((row) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        votes: row.votes,
        views: row.views,
        answers: row.answers_count,
        tags: row.tag_names ? row.tag_names.split(",") : [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        author: { id: row.author_id, name: row.author_name },
      })),
    );
  }),
);

router.get(
  "/questions/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [questionRows] = await pool.query(
      `SELECT q.id, q.title, q.content, q.votes, q.views, q.answers_count, q.created_at, q.updated_at,
              u.id AS author_id, u.name AS author_name, GROUP_CONCAT(DISTINCT t.name) AS tag_names
       FROM questions q
       JOIN users u ON u.id = q.author_id
       LEFT JOIN question_tags qt ON qt.question_id = q.id
       LEFT JOIN tags t ON t.id = qt.tag_id
       WHERE q.id = ? AND q.is_hidden = 0
       GROUP BY q.id, u.id
       LIMIT 1`,
      [id],
    );
    if (!questionRows.length) return res.status(404).json({ message: "Question not found" });
    const [answerRows] = await pool.query(
      `SELECT a.id, a.question_id, a.content, a.votes, a.is_accepted, a.created_at, a.updated_at, u.id AS author_id, u.name AS author_name
       FROM answers a
       JOIN users u ON u.id = a.author_id
       WHERE a.question_id = ? AND a.is_hidden = 0
       ORDER BY a.is_accepted DESC, a.votes DESC, a.created_at ASC`,
      [id],
    );
    const row = questionRows[0];
    res.json({
      id: row.id,
      title: row.title,
      content: row.content,
      votes: row.votes,
      views: row.views,
      answers: row.answers_count,
      tags: row.tag_names ? row.tag_names.split(",") : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      author: { id: row.author_id, name: row.author_name },
      answerItems: answerRows.map((answer) => ({
        id: answer.id,
        questionId: answer.question_id,
        content: answer.content,
        votes: answer.votes,
        isAccepted: Boolean(answer.is_accepted),
        createdAt: answer.created_at,
        updatedAt: answer.updated_at,
        author: { id: answer.author_id, name: answer.author_name },
      })),
    });
  }),
);

router.get(
  "/answers",
  asyncHandler(async (req, res) => {
    const questionId = Number(req.query.questionId);
    if (!questionId) return res.status(400).json({ message: "questionId is required" });
    const [rows] = await pool.query(
      `SELECT a.id, a.question_id, a.content, a.votes, a.is_accepted, a.created_at, a.updated_at, u.id AS author_id, u.name AS author_name
       FROM answers a
       JOIN users u ON u.id = a.author_id
       JOIN questions q ON q.id = a.question_id
       WHERE a.question_id = ? AND a.is_hidden = 0 AND q.is_hidden = 0
       ORDER BY a.is_accepted DESC, a.votes DESC, a.created_at ASC`,
      [questionId],
    );
    res.json(
      rows.map((row) => ({
        id: row.id,
        questionId: row.question_id,
        content: row.content,
        votes: row.votes,
        isAccepted: Boolean(row.is_accepted),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        author: { id: row.author_id, name: row.author_name },
      })),
    );
  }),
);

router.get(
  "/articles",
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query(
      `SELECT a.id, a.title, a.excerpt, a.content, a.cover, a.views, a.likes, a.comments_count, a.published_at,
              u.id AS author_id, u.name AS author_name, GROUP_CONCAT(DISTINCT t.name) AS tag_names
       FROM articles a
       JOIN users u ON u.id = a.author_id
       LEFT JOIN article_tags at ON at.article_id = a.id
       LEFT JOIN tags t ON t.id = at.tag_id
       WHERE a.is_hidden = 0
       GROUP BY a.id, u.id
       ORDER BY a.published_at DESC`,
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
        tags: row.tag_names ? row.tag_names.split(",") : [],
        publishedAt: row.published_at,
        author: { id: row.author_id, name: row.author_name },
      })),
    );
  }),
);

router.get(
  "/articles/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT a.id, a.title, a.excerpt, a.content, a.cover, a.views, a.likes, a.comments_count, a.published_at,
              u.id AS author_id, u.name AS author_name, GROUP_CONCAT(DISTINCT t.name) AS tag_names
       FROM articles a
       JOIN users u ON u.id = a.author_id
       LEFT JOIN article_tags at ON at.article_id = a.id
       LEFT JOIN tags t ON t.id = at.tag_id
       WHERE a.id = ? AND a.is_hidden = 0
       GROUP BY a.id, u.id
       LIMIT 1`,
      [id],
    );
    if (!rows.length) return res.status(404).json({ message: "Article not found" });
    const row = rows[0];
    res.json({
      id: row.id,
      title: row.title,
      excerpt: row.excerpt,
      content: row.content,
      cover: row.cover,
      views: row.views,
      likes: row.likes,
      comments: row.comments_count,
      tags: row.tag_names ? row.tag_names.split(",") : [],
      publishedAt: row.published_at,
      author: { id: row.author_id, name: row.author_name },
    });
  }),
);

router.get(
  "/tags",
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query("SELECT id, name FROM tags ORDER BY name ASC");
    res.json(rows);
  }),
);

router.get(
  "/topics",
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query("SELECT id, title, description, category, trend, posts, views FROM topics ORDER BY trend DESC, views DESC");
    res.json(rows);
  }),
);

router.get(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [users] = await pool.query("SELECT id, name, avatar, reputation, bio, location, website, created_at FROM users WHERE id = ? LIMIT 1", [id]);
    if (!users.length) return res.status(404).json({ message: "User not found" });
    const [questions] = await pool.query(
      "SELECT id, title, views, votes, answers_count, created_at FROM questions WHERE author_id = ? AND is_hidden = 0 ORDER BY created_at DESC LIMIT 20",
      [id],
    );
    res.json({ user: users[0], questions });
  }),
);

export default router;
