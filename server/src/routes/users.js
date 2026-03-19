import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [users] = await pool.query(
      "SELECT id, name, avatar, reputation, bio, location, website, created_at FROM users WHERE id = ? LIMIT 1",
      [id],
    );
    if (!users.length) return res.status(404).json({ message: "User not found" });

    const [questions] = await pool.query(
      "SELECT id, title, views, votes, answers_count, created_at FROM questions WHERE author_id = ? ORDER BY created_at DESC LIMIT 20",
      [id],
    );
    const [answers] = await pool.query(
      "SELECT id, question_id, content, votes, is_accepted, created_at FROM answers WHERE author_id = ? ORDER BY created_at DESC LIMIT 20",
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
});

router.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = updateSchema.parse(req.body);
    const fields = [];
    const values = [];
    for (const key of ["name", "avatar", "bio", "location", "website"]) {
      if (Object.hasOwn(payload, key)) {
        fields.push(`${key} = ?`);
        values.push(payload[key]);
      }
    }
    if (!fields.length) return res.json({ success: true });
    values.push(req.user.userId);
    await pool.query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);
    res.json({ success: true });
  }),
);

export default router;