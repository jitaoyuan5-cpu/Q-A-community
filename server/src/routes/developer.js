import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";
import { generateApiKey } from "../utils/api-keys.js";

const router = Router();

const keySchema = z.object({
  name: z.string().min(2).max(120),
});

router.use(requireAuth);

router.get(
  "/keys",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT id, name, key_prefix, last_used_at, revoked_at, created_at
       FROM developer_api_keys
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.user.userId],
    );
    res.json(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        keyPrefix: row.key_prefix,
        lastUsedAt: row.last_used_at,
        revokedAt: row.revoked_at,
        createdAt: row.created_at,
      })),
    );
  }),
);

router.post(
  "/keys",
  asyncHandler(async (req, res) => {
    const payload = keySchema.parse(req.body);
    const [activeRows] = await pool.query(
      "SELECT COUNT(*) AS count FROM developer_api_keys WHERE user_id = ? AND revoked_at IS NULL",
      [req.user.userId],
    );
    if (Number(activeRows[0]?.count || 0) >= 2) {
      return res.status(409).json({ message: "You already have the maximum number of active API keys" });
    }

    const key = generateApiKey();
    const [result] = await pool.query(
      "INSERT INTO developer_api_keys (user_id, name, key_prefix, key_hash) VALUES (?, ?, ?, ?)",
      [req.user.userId, payload.name, key.keyPrefix, key.keyHash],
    );

    res.status(201).json({
      id: result.insertId,
      name: payload.name,
      keyPrefix: key.keyPrefix,
      secret: key.raw,
    });
  }),
);

router.delete(
  "/keys/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await pool.query("UPDATE developer_api_keys SET revoked_at = NOW() WHERE id = ? AND user_id = ?", [id, req.user.userId]);
    res.json({ success: true });
  }),
);

export default router;
