import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const createSchema = z.object({
  targetType: z.enum(["question", "answer"]),
  targetId: z.number(),
  content: z.string().min(1).max(2000),
  parentId: z.number().nullable().optional(),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const targetType = req.query.targetType;
    const targetId = Number(req.query.targetId);
    if (!targetType || !targetId) return res.status(400).json({ message: "targetType and targetId required" });

    const [rows] = await pool.query(
      `SELECT c.id, c.parent_id, c.content, c.created_at, c.updated_at, c.author_id,
              u.name AS author_name, u.avatar AS author_avatar
       FROM comments c
       JOIN users u ON u.id = c.author_id
       WHERE c.target_type = ? AND c.target_id = ?
       ORDER BY c.created_at ASC`,
      [targetType, targetId],
    );

    const nodes = rows.map((row) => ({
      id: row.id,
      parentId: row.parent_id,
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      author: { id: row.author_id, name: row.author_name, avatar: row.author_avatar },
      replies: [],
    }));

    const map = new Map(nodes.map((n) => [n.id, n]));
    const roots = [];
    for (const node of nodes) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId).replies.push(node);
      } else {
        roots.push(node);
      }
    }

    res.json(roots);
  }),
);

router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = createSchema.parse(req.body);
    const [result] = await pool.query(
      "INSERT INTO comments (target_type, target_id, parent_id, author_id, content) VALUES (?, ?, ?, ?, ?)",
      [payload.targetType, payload.targetId, payload.parentId || null, req.user.userId, payload.content.trim()],
    );
    res.status(201).json({ id: result.insertId });
  }),
);

router.patch(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const content = String(req.body?.content || "").trim();
    if (!content) return res.status(400).json({ message: "Content required" });

    const [rows] = await pool.query("SELECT author_id FROM comments WHERE id = ? LIMIT 1", [id]);
    if (!rows.length) return res.status(404).json({ message: "Comment not found" });
    if (rows[0].author_id !== req.user.userId) return res.status(403).json({ message: "Forbidden" });

    await pool.query("UPDATE comments SET content = ? WHERE id = ?", [content, id]);
    res.json({ success: true });
  }),
);

router.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [rows] = await pool.query("SELECT author_id FROM comments WHERE id = ? LIMIT 1", [id]);
    if (!rows.length) return res.status(404).json({ message: "Comment not found" });
    if (rows[0].author_id !== req.user.userId) return res.status(403).json({ message: "Forbidden" });

    await pool.query("DELETE FROM comments WHERE id = ?", [id]);
    res.json({ success: true });
  }),
);

export default router;