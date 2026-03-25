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
    description: "Read-only public endpoints for questions, answers, articles, tags, topics, and public user profiles.",
  },
  components: {
    securitySchemes: {
      apiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "x-api-key",
      },
    },
    parameters: {
      QuestionId: {
        name: "id",
        in: "path",
        required: true,
        description: "Question identifier",
        schema: { type: "integer" },
      },
      ArticleId: {
        name: "id",
        in: "path",
        required: true,
        description: "Article identifier",
        schema: { type: "integer" },
      },
      UserId: {
        name: "id",
        in: "path",
        required: true,
        description: "User identifier",
        schema: { type: "integer" },
      },
      QuestionIdQuery: {
        name: "questionId",
        in: "query",
        required: true,
        description: "Question identifier used to filter answers",
        schema: { type: "integer" },
      },
    },
    responses: {
      Unauthorized: {
        description: "Missing or invalid API key",
        content: {
          "application/json": {
            example: { message: "Invalid API key" },
          },
        },
      },
      RateLimited: {
        description: "Hourly request limit exceeded",
        content: {
          "application/json": {
            example: { message: "Rate limit exceeded" },
          },
        },
      },
      NotFound: {
        description: "Requested resource was not found",
        content: {
          "application/json": {
            example: { message: "Resource not found" },
          },
        },
      },
      BadRequest: {
        description: "Request validation failed",
        content: {
          "application/json": {
            example: { message: "questionId is required" },
          },
        },
      },
    },
    schemas: {
      PublicAuthor: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "张三" },
        },
      },
      PublicQuestion: {
        type: "object",
        required: ["id", "title", "content", "votes", "views", "answers", "tags", "createdAt", "updatedAt", "author"],
        properties: {
          id: { type: "integer", example: 1 },
          title: { type: "string", example: "React 中 useState 和 useReducer 的区别是什么？" },
          content: { type: "string", example: "我在学习 React Hooks，想知道什么时候应该使用 useState，什么时候应该使用 useReducer？" },
          votes: { type: "integer", example: 15 },
          views: { type: "integer", example: 1245 },
          answers: { type: "integer", example: 3 },
          tags: { type: "array", items: { type: "string" }, example: ["React", "Hooks"] },
          createdAt: { type: "string", format: "date-time", example: "2026-03-17T10:30:00.000Z" },
          updatedAt: { type: "string", format: "date-time", example: "2026-03-17T10:30:00.000Z" },
          author: { $ref: "#/components/schemas/PublicAuthor" },
        },
      },
      PublicAnswer: {
        type: "object",
        required: ["id", "questionId", "content", "votes", "isAccepted", "createdAt", "updatedAt", "author"],
        properties: {
          id: { type: "integer", example: 11 },
          questionId: { type: "integer", example: 1 },
          content: { type: "string", example: "useState 适合简单状态；useReducer 适合复杂状态逻辑与状态转换。" },
          votes: { type: "integer", example: 23 },
          isAccepted: { type: "boolean", example: true },
          createdAt: { type: "string", format: "date-time", example: "2026-03-17T11:15:00.000Z" },
          updatedAt: { type: "string", format: "date-time", example: "2026-03-17T11:15:00.000Z" },
          author: { $ref: "#/components/schemas/PublicAuthor" },
        },
      },
      PublicQuestionDetail: {
        allOf: [
          { $ref: "#/components/schemas/PublicQuestion" },
          {
            type: "object",
            required: ["answerItems"],
            properties: {
              answerItems: {
                type: "array",
                items: { $ref: "#/components/schemas/PublicAnswer" },
              },
            },
          },
        ],
      },
      PublicArticle: {
        type: "object",
        required: ["id", "title", "excerpt", "content", "cover", "views", "likes", "comments", "tags", "publishedAt", "author"],
        properties: {
          id: { type: "integer", example: 1 },
          title: { type: "string", example: "深入理解 React Server Components" },
          excerpt: { type: "string", example: "从渲染边界理解 RSC。" },
          content: { type: "string", example: "从组件边界、数据获取策略到性能权衡..." },
          cover: { type: "string", example: "https://example.com/react-rsc.png" },
          views: { type: "integer", example: 3456 },
          likes: { type: "integer", example: 128 },
          comments: { type: "integer", example: 45 },
          tags: { type: "array", items: { type: "string" }, example: ["React", "前端"] },
          publishedAt: { type: "string", format: "date-time", example: "2026-03-15T10:00:00.000Z" },
          author: { $ref: "#/components/schemas/PublicAuthor" },
        },
      },
      PublicTag: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "React" },
        },
      },
      PublicTopic: {
        type: "object",
        required: ["id", "title", "description", "category", "trend", "posts", "views"],
        properties: {
          id: { type: "integer", example: 1 },
          title: { type: "string", example: "AI 编程助手对开发者的影响" },
          description: { type: "string", example: "讨论 AI 工具如何改变开发流程与岗位分工。" },
          category: { type: "string", example: "AI" },
          trend: { type: "integer", example: 25 },
          posts: { type: "integer", example: 156 },
          views: { type: "integer", example: 12400 },
        },
      },
      PublicUserProfile: {
        type: "object",
        required: ["id", "name", "avatar", "reputation", "bio", "location", "website", "createdAt", "questions"],
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "张三" },
          avatar: { type: "string", example: "https://i.pravatar.cc/80?img=1" },
          reputation: { type: "integer", example: 2850 },
          bio: { type: "string", nullable: true, example: "专注前端架构与性能优化。" },
          location: { type: "string", nullable: true, example: "Shanghai" },
          website: { type: "string", nullable: true, example: "https://example.com" },
          createdAt: { type: "string", format: "date-time", example: "2026-03-01T00:00:00.000Z" },
          questions: {
            type: "array",
            items: { $ref: "#/components/schemas/PublicQuestion" },
          },
        },
      },
    },
  },
  paths: {
    "/api/public/v1/questions": {
      get: {
        summary: "List public questions",
        description: "Returns public, non-hidden questions ordered by creation time.",
        security: [{ apiKeyAuth: [] }],
        responses: {
          200: {
            description: "A list of public questions",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/PublicQuestion" } },
                example: [
                  {
                    id: 1,
                    title: "React 中 useState 和 useReducer 的区别是什么？",
                    content: "我在学习 React Hooks...",
                    votes: 15,
                    views: 1245,
                    answers: 3,
                    tags: ["React", "Hooks"],
                    createdAt: "2026-03-17T10:30:00.000Z",
                    updatedAt: "2026-03-17T10:30:00.000Z",
                    author: { id: 1, name: "张三" },
                  },
                ],
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          429: { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    "/api/public/v1/questions/{id}": {
      get: {
        summary: "Get public question detail",
        description: "Returns one public question and its public answers.",
        security: [{ apiKeyAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/QuestionId" }],
        responses: {
          200: {
            description: "Question detail",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PublicQuestionDetail" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
          429: { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    "/api/public/v1/answers": {
      get: {
        summary: "List answers by questionId",
        description: "Returns public answers for a given public question.",
        security: [{ apiKeyAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/QuestionIdQuery" }],
        responses: {
          200: {
            description: "Answers for the requested question",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/PublicAnswer" } },
              },
            },
          },
          400: { $ref: "#/components/responses/BadRequest" },
          401: { $ref: "#/components/responses/Unauthorized" },
          429: { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    "/api/public/v1/articles": {
      get: {
        summary: "List public articles",
        description: "Returns public, non-hidden articles ordered by publish time.",
        security: [{ apiKeyAuth: [] }],
        responses: {
          200: {
            description: "A list of public articles",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/PublicArticle" } },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          429: { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    "/api/public/v1/articles/{id}": {
      get: {
        summary: "Get public article detail",
        description: "Returns one public article.",
        security: [{ apiKeyAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/ArticleId" }],
        responses: {
          200: {
            description: "Article detail",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PublicArticle" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
          429: { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    "/api/public/v1/tags": {
      get: {
        summary: "List tags",
        description: "Returns all tags used by the public content model.",
        security: [{ apiKeyAuth: [] }],
        responses: {
          200: {
            description: "A list of tags",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/PublicTag" } },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          429: { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    "/api/public/v1/topics": {
      get: {
        summary: "List topics",
        description: "Returns public hot topics ordered by trend and views.",
        security: [{ apiKeyAuth: [] }],
        responses: {
          200: {
            description: "A list of topics",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/PublicTopic" } },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          429: { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    "/api/public/v1/users/{id}": {
      get: {
        summary: "Get public user profile",
        description: "Returns one public user profile and their public questions.",
        security: [{ apiKeyAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/UserId" }],
        responses: {
          200: {
            description: "Public profile detail",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PublicUserProfile" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
          429: { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
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
