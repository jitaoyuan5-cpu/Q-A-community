import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";
import { mapNotificationRow } from "../utils/notifications.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const unreadOnly = req.query.unread === "1";
    const [rows] = await pool.query(
      `SELECT n.*, actor.id AS actor_id, actor.name AS actor_name, actor.avatar AS actor_avatar
       FROM notifications n
       LEFT JOIN users actor ON actor.id = n.actor_id
       WHERE n.user_id = ? ${unreadOnly ? "AND n.is_read = 0" : ""}
       ORDER BY n.created_at DESC
       LIMIT 100`,
      [req.user.userId],
    );
    const [counts] = await pool.query("SELECT COUNT(*) AS unreadCount FROM notifications WHERE user_id = ? AND is_read = 0", [req.user.userId]);
    res.json({
      unreadCount: Number(counts[0]?.unreadCount || 0),
      items: rows.map(mapNotificationRow),
    });
  }),
);

router.post(
  "/:id/read",
  requireAuth,
  asyncHandler(async (req, res) => {
    await pool.query("UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND user_id = ?", [
      Number(req.params.id),
      req.user.userId,
    ]);
    res.json({ success: true });
  }),
);

router.post(
  "/read-all",
  requireAuth,
  asyncHandler(async (req, res) => {
    await pool.query("UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0", [req.user.userId]);
    res.json({ success: true });
  }),
);

export default router;
