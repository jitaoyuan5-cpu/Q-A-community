import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";
import { createNotification, notificationTypes, shouldSendEmailForType } from "../utils/notifications.js";
import { sendTemplatedEmail } from "../utils/mailer.js";
import { tSystem } from "../utils/locale.js";

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
       WHERE c.target_type = ? AND c.target_id = ? AND c.is_hidden = 0
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
    if (payload.targetType === "question") {
      const [targetRows] = await pool.query(
        `SELECT q.id, q.title, q.author_id AS owner_id, u.email AS owner_email, u.preferred_locale AS owner_locale
         FROM questions q
         JOIN users u ON u.id = q.author_id
         WHERE q.id = ? AND q.is_hidden = 0 LIMIT 1`,
        [payload.targetId],
      );
      if (!targetRows.length) return res.status(404).json({ message: "Question not found" });

      const [result] = await pool.query(
        "INSERT INTO comments (target_type, target_id, parent_id, author_id, content) VALUES (?, ?, ?, ?, ?)",
        [payload.targetType, payload.targetId, payload.parentId || null, req.user.userId, payload.content.trim()],
      );
      const owner = targetRows[0];
      if (owner.owner_id !== req.user.userId) {
        const ownerLocale = owner.owner_locale || "zh-CN";
        await createNotification(pool, {
          userId: owner.owner_id,
          actorId: req.user.userId,
          type: notificationTypes.newComment,
          targetType: "comment",
          targetId: result.insertId,
          title: tSystem(ownerLocale, "notifications", "questionCommentTitle"),
          body: owner.title,
          link: `/question/${payload.targetId}`,
        });
        if (await shouldSendEmailForType(pool, owner.owner_id, notificationTypes.newComment)) {
          await sendTemplatedEmail({
            to: owner.owner_email,
            subject: tSystem(ownerLocale, "emails", "questionCommentSubject"),
            text: tSystem(ownerLocale, "emails", "questionCommentText", { title: owner.title, link: `/question/${payload.targetId}` }),
          });
        }
      }
      return res.status(201).json({ id: result.insertId });
    }

    const [targetRows] = await pool.query(
      `SELECT a.id, a.question_id, a.author_id AS owner_id, q.title, u.email AS owner_email, u.preferred_locale AS owner_locale
       FROM answers a
       JOIN questions q ON q.id = a.question_id
       JOIN users u ON u.id = a.author_id
       WHERE a.id = ? AND a.is_hidden = 0 LIMIT 1`,
      [payload.targetId],
    );
    if (!targetRows.length) return res.status(404).json({ message: "Answer not found" });
    const [result] = await pool.query(
      "INSERT INTO comments (target_type, target_id, parent_id, author_id, content) VALUES (?, ?, ?, ?, ?)",
      [payload.targetType, payload.targetId, payload.parentId || null, req.user.userId, payload.content.trim()],
    );
    const owner = targetRows[0];
    if (owner.owner_id !== req.user.userId) {
      const ownerLocale = owner.owner_locale || "zh-CN";
      await createNotification(pool, {
        userId: owner.owner_id,
        actorId: req.user.userId,
        type: notificationTypes.newComment,
        targetType: "comment",
        targetId: result.insertId,
        title: tSystem(ownerLocale, "notifications", "answerCommentTitle"),
        body: owner.title,
        link: `/question/${owner.question_id}`,
      });
      if (await shouldSendEmailForType(pool, owner.owner_id, notificationTypes.newComment)) {
        await sendTemplatedEmail({
          to: owner.owner_email,
          subject: tSystem(ownerLocale, "emails", "answerCommentSubject"),
          text: tSystem(ownerLocale, "emails", "answerCommentText", { title: owner.title, link: `/question/${owner.question_id}` }),
        });
      }
    }
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

    const [rows] = await pool.query("SELECT author_id FROM comments WHERE id = ? AND is_hidden = 0 LIMIT 1", [id]);
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
    const [rows] = await pool.query("SELECT author_id FROM comments WHERE id = ? AND is_hidden = 0 LIMIT 1", [id]);
    if (!rows.length) return res.status(404).json({ message: "Comment not found" });
    if (rows[0].author_id !== req.user.userId) return res.status(403).json({ message: "Forbidden" });

    await pool.query("DELETE FROM comments WHERE id = ?", [id]);
    res.json({ success: true });
  }),
);

export default router;
