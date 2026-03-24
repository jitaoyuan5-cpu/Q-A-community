import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";
import { parseJsonField } from "../utils/json.js";

const router = Router();

const progressSchema = z.object({
  lessonId: z.number().int().positive().nullable().optional(),
  progressPercent: z.number().int().min(0).max(100),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const tag = String(req.query.tag || "").trim();
    const difficulty = String(req.query.difficulty || "").trim();
    const filters = ["t.is_hidden = 0", "t.is_published = 1"];
    const args = [];
    if (tag) {
      filters.push("t.id IN (SELECT tutorial_id FROM tutorial_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tg.name = ?)");
      args.push(tag);
    }
    if (difficulty) {
      filters.push("t.difficulty = ?");
      args.push(difficulty);
    }

    const [rows] = await pool.query(
      `SELECT t.id, t.title, t.summary, t.description, t.cover, t.difficulty, t.created_at, t.updated_at,
              u.id AS author_id, u.name AS author_name, u.avatar AS author_avatar,
              GROUP_CONCAT(DISTINCT tg.name) AS tag_names,
              COUNT(DISTINCT l.id) AS lesson_count,
              ${req.user ? "MAX(CASE WHEN f.id IS NULL THEN 0 ELSE 1 END) AS is_favorited, MAX(tp.progress_percent) AS progress_percent, MAX(tp.lesson_id) AS last_lesson_id" : "0 AS is_favorited, 0 AS progress_percent, NULL AS last_lesson_id"}
       FROM tutorials t
       JOIN users u ON u.id = t.author_id
       LEFT JOIN tutorial_lessons l ON l.tutorial_id = t.id
       LEFT JOIN tutorial_tags tt ON tt.tutorial_id = t.id
       LEFT JOIN tags tg ON tg.id = tt.tag_id
       ${req.user ? "LEFT JOIN favorites f ON f.target_type = 'tutorial' AND f.target_id = t.id AND f.user_id = ? LEFT JOIN tutorial_progress tp ON tp.tutorial_id = t.id AND tp.user_id = ?" : ""}
       WHERE ${filters.join(" AND ")}
       GROUP BY t.id, u.id
       ORDER BY t.updated_at DESC`,
      req.user ? [req.user.userId, req.user.userId, ...args] : args,
    );

    res.json(
      rows.map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        description: row.description,
        cover: row.cover,
        difficulty: row.difficulty,
        lessonCount: Number(row.lesson_count || 0),
        tags: row.tag_names ? row.tag_names.split(",") : [],
        isFavorited: Boolean(row.is_favorited),
        progressPercent: Number(row.progress_percent || 0),
        lastLessonId: row.last_lesson_id ? Number(row.last_lesson_id) : null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        author: { id: row.author_id, name: row.author_name, avatar: row.author_avatar },
      })),
    );
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const tutorialId = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT t.id, t.title, t.summary, t.description, t.cover, t.difficulty, t.created_at, t.updated_at,
              u.id AS author_id, u.name AS author_name, u.avatar AS author_avatar,
              GROUP_CONCAT(DISTINCT tg.name) AS tag_names,
              ${req.user ? "MAX(CASE WHEN f.id IS NULL THEN 0 ELSE 1 END) AS is_favorited, MAX(tp.progress_percent) AS progress_percent, MAX(tp.lesson_id) AS last_lesson_id" : "0 AS is_favorited, 0 AS progress_percent, NULL AS last_lesson_id"}
       FROM tutorials t
       JOIN users u ON u.id = t.author_id
       LEFT JOIN tutorial_tags tt ON tt.tutorial_id = t.id
       LEFT JOIN tags tg ON tg.id = tt.tag_id
       ${req.user ? "LEFT JOIN favorites f ON f.target_type = 'tutorial' AND f.target_id = t.id AND f.user_id = ? LEFT JOIN tutorial_progress tp ON tp.tutorial_id = t.id AND tp.user_id = ?" : ""}
       WHERE t.id = ? AND t.is_hidden = 0 AND t.is_published = 1
       GROUP BY t.id, u.id
       LIMIT 1`,
      req.user ? [req.user.userId, req.user.userId, tutorialId] : [tutorialId],
    );
    if (!rows.length) return res.status(404).json({ message: "Tutorial not found" });

    const [lessonRows] = await pool.query(
      `SELECT id, title, description, sort_order, video_provider, video_url, embed_url, duration_seconds, starter_template, starter_files
       FROM tutorial_lessons
       WHERE tutorial_id = ?
       ORDER BY sort_order ASC, id ASC`,
      [tutorialId],
    );
    const row = rows[0];
    res.json({
      id: row.id,
      title: row.title,
      summary: row.summary,
      description: row.description,
      cover: row.cover,
      difficulty: row.difficulty,
      tags: row.tag_names ? row.tag_names.split(",") : [],
      isFavorited: Boolean(row.is_favorited),
      progressPercent: Number(row.progress_percent || 0),
      lastLessonId: row.last_lesson_id ? Number(row.last_lesson_id) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      author: { id: row.author_id, name: row.author_name, avatar: row.author_avatar },
      lessons: lessonRows.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        sortOrder: lesson.sort_order,
        videoProvider: lesson.video_provider,
        videoUrl: lesson.video_url,
        embedUrl: lesson.embed_url,
        durationSeconds: lesson.duration_seconds,
        starterTemplate: lesson.starter_template,
        starterFiles: parseJsonField(lesson.starter_files, null),
      })),
    });
  }),
);

router.put(
  "/:id/progress",
  requireAuth,
  asyncHandler(async (req, res) => {
    const tutorialId = Number(req.params.id);
    const payload = progressSchema.parse(req.body);
    const [tutorialRows] = await pool.query("SELECT id FROM tutorials WHERE id = ? AND is_hidden = 0 AND is_published = 1 LIMIT 1", [tutorialId]);
    if (!tutorialRows.length) return res.status(404).json({ message: "Tutorial not found" });

    let lessonId = payload.lessonId ?? null;
    if (lessonId) {
      const [lessonRows] = await pool.query("SELECT id FROM tutorial_lessons WHERE id = ? AND tutorial_id = ? LIMIT 1", [lessonId, tutorialId]);
      if (!lessonRows.length) return res.status(400).json({ message: "Lesson does not belong to tutorial" });
    }

    await pool.query(
      `INSERT INTO tutorial_progress (user_id, tutorial_id, lesson_id, progress_percent)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE lesson_id = VALUES(lesson_id), progress_percent = VALUES(progress_percent), updated_at = NOW()`,
      [req.user.userId, tutorialId, lessonId, payload.progressPercent],
    );
    res.json({ success: true });
  }),
);

export default router;
