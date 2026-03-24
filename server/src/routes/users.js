import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";
import { getUserPreferences } from "../utils/notifications.js";

const router = Router();

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [users] = await pool.query(
      "SELECT id, name, avatar, reputation, bio, location, website, role, preferred_locale, created_at FROM users WHERE id = ? LIMIT 1",
      [id],
    );
    if (!users.length) return res.status(404).json({ message: "User not found" });

    const [questions] = await pool.query(
      "SELECT id, title, views, votes, answers_count, created_at FROM questions WHERE author_id = ? AND is_hidden = 0 ORDER BY created_at DESC LIMIT 20",
      [id],
    );
    const [answers] = await pool.query(
      `SELECT a.id, a.question_id, a.content, a.votes, a.is_accepted, a.created_at
       FROM answers a
       JOIN questions q ON q.id = a.question_id
       WHERE a.author_id = ? AND a.is_hidden = 0 AND q.is_hidden = 0
       ORDER BY a.created_at DESC
       LIMIT 20`,
      [id],
    );

    res.json({ user: users[0], questions, answers });
  }),
);

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  avatar: z.string().url().optional().or(z.literal("")),
  bio: z.string().max(1000).optional(),
  location: z.string().max(191).optional(),
  website: z.string().url().optional().or(z.literal("")),
  preferredLocale: z.enum(["zh-CN", "en-US"]).optional(),
});

const preferenceSchema = z.object({
  emailEnabled: z.boolean(),
  notifyNewAnswer: z.boolean(),
  notifyNewComment: z.boolean(),
  notifyAnswerAccepted: z.boolean(),
  notifyFollowUpdate: z.boolean(),
});

router.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = updateSchema.parse(req.body);
    const fields = [];
    const values = [];
    const columnByKey = {
      name: "name",
      avatar: "avatar",
      bio: "bio",
      location: "location",
      website: "website",
      preferredLocale: "preferred_locale",
    };
    for (const key of Object.keys(columnByKey)) {
      if (Object.hasOwn(payload, key)) {
        fields.push(`${columnByKey[key]} = ?`);
        values.push(payload[key]);
      }
    }
    if (!fields.length) return res.json({ success: true });
    values.push(req.user.userId);
    await pool.query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);
    res.json({ success: true });
  }),
);

router.get(
  "/me/preferences",
  requireAuth,
  asyncHandler(async (req, res) => {
    const preferences = await getUserPreferences(pool, req.user.userId);
    res.json(preferences);
  }),
);

router.put(
  "/me/preferences",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = preferenceSchema.parse(req.body);
    await pool.query(
      `INSERT INTO user_notification_preferences
       (user_id, email_enabled, notify_new_answer, notify_new_comment, notify_answer_accepted, notify_follow_update)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       email_enabled = VALUES(email_enabled),
       notify_new_answer = VALUES(notify_new_answer),
       notify_new_comment = VALUES(notify_new_comment),
       notify_answer_accepted = VALUES(notify_answer_accepted),
       notify_follow_update = VALUES(notify_follow_update)`,
      [
        req.user.userId,
        payload.emailEnabled ? 1 : 0,
        payload.notifyNewAnswer ? 1 : 0,
        payload.notifyNewComment ? 1 : 0,
        payload.notifyAnswerAccepted ? 1 : 0,
        payload.notifyFollowUpdate ? 1 : 0,
      ],
    );
    res.json({ success: true });
  }),
);

export default router;
