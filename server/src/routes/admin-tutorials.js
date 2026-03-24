import { Router } from "express";
import { z } from "zod";
import { pool, withTx } from "../db/pool.js";
import { requireAdmin } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../utils/http.js";
import { buildEmbedUrl, normalizeStarterFiles, tutorialDifficulties } from "../utils/tutorials.js";
import { parseJsonField } from "../utils/json.js";

const router = Router();

const lessonSchema = z.object({
  id: z.number().int().positive().optional(),
  title: z.string().min(2, "课时标题至少 2 个字").max(255, "课时标题不能超过 255 个字"),
  description: z.string().min(2, "课时说明至少 2 个字").max(5000, "课时说明不能超过 5000 个字"),
  sortOrder: z.number().int().min(0, "排序不能小于 0").optional().default(0),
  videoUrl: z.string().url("视频地址必须是合法 URL"),
  durationSeconds: z.number().int().min(0, "时长不能小于 0").optional().default(0),
  starterTemplate: z.enum(["html", "typescript", "react"]).nullable().optional(),
  starterFiles: z.record(z.string(), z.string()).nullable().optional(),
});

const tutorialSchema = z.object({
  title: z.string().min(2, "教程标题至少 2 个字").max(255, "教程标题不能超过 255 个字"),
  summary: z.string().min(10, "教程摘要至少 10 个字").max(1000, "教程摘要不能超过 1000 个字"),
  description: z.string().min(10, "课程介绍至少 10 个字").max(20000, "课程介绍不能超过 20000 个字"),
  cover: z.string().url().or(z.literal("")).optional().default(""),
  difficulty: z.enum(tutorialDifficulties),
  isPublished: z.boolean().optional().default(true),
  tags: z.array(z.string().min(1).max(80)).max(6, "标签最多 6 个").optional().default([]),
  lessons: z.array(lessonSchema).min(1, "至少添加 1 个课时").max(30, "课时不能超过 30 个"),
});

const tutorialFieldLabels = {
  title: "教程标题",
  summary: "教程摘要",
  description: "课程介绍",
  cover: "封面地址",
  difficulty: "课程难度",
  tags: "课程标签",
  lessons: "课时列表",
  videoUrl: "视频地址",
  durationSeconds: "时长",
  starterTemplate: "Starter 模板",
  starterFiles: "Starter files",
};

const formatTutorialIssue = (issue) => {
  const [root, index, child] = issue.path || [];
  if (!issue.path?.length) return issue.message || "教程表单校验失败";

  if (root === "cover") return "封面地址必须是合法 URL，或者留空";
  if (root === "difficulty") return "课程难度只能是 beginner、intermediate 或 advanced";
  if (root === "tags") return issue.message || "课程标签填写不正确";
  if (root === "lessons" && child == null) return issue.message || "请至少添加 1 个课时";

  if (root === "lessons" && typeof index === "number") {
    const label = tutorialFieldLabels[child] || String(child || "字段");
    if (issue.message) return `第 ${index + 1} 个课时：${issue.message}`;
    return `第 ${index + 1} 个课时的${label}填写不正确`;
  }

  return issue.message || `${tutorialFieldLabels[root] || String(root)}填写不正确`;
};

const parseTutorialPayload = (payload) => {
  const result = tutorialSchema.safeParse(payload);
  if (!result.success) {
    throw new ApiError(400, formatTutorialIssue(result.error.issues[0]));
  }
  return result.data;
};

const syncTags = async (conn, tutorialId, tags) => {
  await conn.query("DELETE FROM tutorial_tags WHERE tutorial_id = ?", [tutorialId]);
  for (const name of tags) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    await conn.query("INSERT INTO tags (name) VALUES (?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)", [trimmed]);
    const [tagRows] = await conn.query("SELECT LAST_INSERT_ID() AS id");
    await conn.query("INSERT IGNORE INTO tutorial_tags (tutorial_id, tag_id) VALUES (?, ?)", [tutorialId, tagRows[0].id]);
  }
};

const syncLessons = async (conn, tutorialId, lessons) => {
  await conn.query("DELETE FROM tutorial_lessons WHERE tutorial_id = ?", [tutorialId]);
  for (const [index, lesson] of lessons.entries()) {
    const embed = buildEmbedUrl(lesson.videoUrl);
    if (!embed) {
      throw new ApiError(400, `第 ${index + 1} 个课时的视频地址只支持 YouTube、Bilibili 或 Vimeo`);
    }
    await conn.query(
      `INSERT INTO tutorial_lessons
       (tutorial_id, title, description, sort_order, video_provider, video_url, embed_url, duration_seconds, starter_template, starter_files)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tutorialId,
        lesson.title.trim(),
        lesson.description.trim(),
        lesson.sortOrder,
        embed.provider,
        lesson.videoUrl,
        embed.embedUrl,
        lesson.durationSeconds,
        lesson.starterTemplate || null,
        JSON.stringify(normalizeStarterFiles(lesson.starterFiles) || null),
      ],
    );
  }
};

router.use(requireAdmin);

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query(
      `SELECT t.id, t.title, t.summary, t.difficulty, t.is_published, t.is_hidden, t.updated_at, COUNT(l.id) AS lesson_count
       FROM tutorials t
       LEFT JOIN tutorial_lessons l ON l.tutorial_id = t.id
       GROUP BY t.id
       ORDER BY t.updated_at DESC`,
    );
    res.json(
      rows.map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        difficulty: row.difficulty,
        isPublished: Boolean(row.is_published),
        isHidden: Boolean(row.is_hidden),
        lessonCount: Number(row.lesson_count || 0),
        updatedAt: row.updated_at,
      })),
    );
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const tutorialId = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT t.id, t.title, t.summary, t.description, t.cover, t.difficulty, t.is_published, t.is_hidden,
              GROUP_CONCAT(DISTINCT tg.name) AS tag_names
       FROM tutorials t
       LEFT JOIN tutorial_tags tt ON tt.tutorial_id = t.id
       LEFT JOIN tags tg ON tg.id = tt.tag_id
       WHERE t.id = ?
       GROUP BY t.id
       LIMIT 1`,
      [tutorialId],
    );
    if (!rows.length) return res.status(404).json({ message: "Tutorial not found" });
    const [lessonRows] = await pool.query(
      `SELECT id, title, description, sort_order, video_url, duration_seconds, starter_template, starter_files
       FROM tutorial_lessons
       WHERE tutorial_id = ?
       ORDER BY sort_order ASC, id ASC`,
      [tutorialId],
    );
    res.json({
      id: rows[0].id,
      title: rows[0].title,
      summary: rows[0].summary,
      description: rows[0].description,
      cover: rows[0].cover,
      difficulty: rows[0].difficulty,
      isPublished: Boolean(rows[0].is_published),
      isHidden: Boolean(rows[0].is_hidden),
      tags: rows[0].tag_names ? rows[0].tag_names.split(",") : [],
      lessons: lessonRows.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        sortOrder: lesson.sort_order,
        videoUrl: lesson.video_url,
        durationSeconds: lesson.duration_seconds,
        starterTemplate: lesson.starter_template,
        starterFiles: parseJsonField(lesson.starter_files, null),
      })),
    });
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = parseTutorialPayload(req.body);
    const tutorialId = await withTx(async (conn) => {
      const [result] = await conn.query(
        `INSERT INTO tutorials (title, summary, description, cover, author_id, difficulty, is_published)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [payload.title.trim(), payload.summary.trim(), payload.description.trim(), payload.cover || "", req.user.userId, payload.difficulty, payload.isPublished ? 1 : 0],
      );
      await syncTags(conn, result.insertId, payload.tags);
      await syncLessons(conn, result.insertId, payload.lessons);
      return result.insertId;
    });
    res.status(201).json({ id: tutorialId });
  }),
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const tutorialId = Number(req.params.id);
    const payload = parseTutorialPayload(req.body);
    const [rows] = await pool.query("SELECT id FROM tutorials WHERE id = ? LIMIT 1", [tutorialId]);
    if (!rows.length) return res.status(404).json({ message: "Tutorial not found" });

    await withTx(async (conn) => {
      await conn.query(
        `UPDATE tutorials
         SET title = ?, summary = ?, description = ?, cover = ?, difficulty = ?, is_published = ?, updated_at = NOW()
         WHERE id = ?`,
        [payload.title.trim(), payload.summary.trim(), payload.description.trim(), payload.cover || "", payload.difficulty, payload.isPublished ? 1 : 0, tutorialId],
      );
      await syncTags(conn, tutorialId, payload.tags);
      await syncLessons(conn, tutorialId, payload.lessons);
    });
    res.json({ success: true });
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const tutorialId = Number(req.params.id);
    await pool.query("DELETE FROM tutorials WHERE id = ?", [tutorialId]);
    res.json({ success: true });
  }),
);

export default router;
