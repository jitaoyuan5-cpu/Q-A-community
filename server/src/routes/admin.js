import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

const router = Router();

const reviewSchema = z.object({
  action: z.enum(["ignore", "hide"]),
  reviewNote: z.string().max(1000).optional().default(""),
});

const tableByType = {
  question: "questions",
  answer: "answers",
  article: "articles",
  comment: "comments",
  chat_message: "question_chat_messages",
};

router.get(
  "/reports",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const status = String(req.query.status || "pending");
    const [rows] = await pool.query(
      `SELECT r.*, reporter.name AS reporter_name, reviewer.name AS reviewer_name
       FROM reports r
       JOIN users reporter ON reporter.id = r.reporter_id
       LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
       WHERE (? = 'all' OR r.status = ?)
       ORDER BY r.created_at DESC`,
      [status, status],
    );
    res.json(
      rows.map((row) => ({
        id: row.id,
        targetType: row.target_type,
        targetId: row.target_id,
        reason: row.reason,
        detail: row.detail,
        status: row.status,
        actionTaken: row.action_taken,
        reviewNote: row.review_note,
        reviewedAt: row.reviewed_at,
        createdAt: row.created_at,
        reporter: { id: row.reporter_id, name: row.reporter_name },
        reviewer: row.reviewed_by ? { id: row.reviewed_by, name: row.reviewer_name } : null,
      })),
    );
  }),
);

router.post(
  "/reports/:id/review",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const reportId = Number(req.params.id);
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid review action" });
    }
    const payload = parsed.data;
    const [rows] = await pool.query("SELECT target_type, target_id, status FROM reports WHERE id = ? LIMIT 1", [reportId]);
    if (!rows.length) return res.status(404).json({ message: "Report not found" });
    if (rows[0].status !== "pending") return res.status(409).json({ message: "Report already reviewed" });

    if (payload.action !== "ignore") {
      const table = tableByType[rows[0].target_type];
      await pool.query(`UPDATE ${table} SET is_hidden = 1 WHERE id = ?`, [rows[0].target_id]);
    }

    await pool.query(
      `UPDATE reports
       SET status = ?, action_taken = ?, review_note = ?, reviewed_by = ?, reviewed_at = NOW()
       WHERE id = ?`,
      [payload.action === "ignore" ? "rejected" : "reviewed", payload.action, payload.reviewNote.trim(), req.user.userId, reportId],
    );

    res.json({ success: true });
  }),
);

export default router;
