import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { ApiError, asyncHandler } from "../utils/http.js";
import { hashPassword, sha256, signAccessToken, signRefreshToken, verifyPassword, verifyRefreshToken } from "../utils/crypto.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2).max(120),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const saveRefreshToken = async (userId, token, expiresAt) => {
  const tokenHash = sha256(token);
  await pool.query("INSERT INTO auth_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)", [userId, tokenHash, expiresAt]);
};

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const payload = registerSchema.parse(req.body);
    const [existsRows] = await pool.query("SELECT id FROM users WHERE email = ? LIMIT 1", [payload.email]);
    if (existsRows.length) throw new ApiError(409, "Email already exists");

    const passwordHash = await hashPassword(payload.password);
    const [insertResult] = await pool.query(
      "INSERT INTO users (email, password_hash, name, avatar, reputation) VALUES (?, ?, ?, '', 0)",
      [payload.email, passwordHash, payload.name],
    );

    const userId = insertResult.insertId;
    const accessToken = signAccessToken({ userId });
    const refreshToken = signRefreshToken({ userId });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await saveRefreshToken(userId, refreshToken, expiresAt);

    res.status(201).json({
      accessToken,
      refreshToken,
      user: { id: userId, email: payload.email, name: payload.name, avatar: "", reputation: 0 },
    });
  }),
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const payload = loginSchema.parse(req.body);
    const [rows] = await pool.query("SELECT id, email, name, avatar, reputation, password_hash FROM users WHERE email = ? LIMIT 1", [payload.email]);
    const user = rows[0];
    if (!user) throw new ApiError(401, "Invalid credentials");

    const ok = await verifyPassword(payload.password, user.password_hash);
    if (!ok) throw new ApiError(401, "Invalid credentials");

    const accessToken = signAccessToken({ userId: user.id });
    const refreshToken = signRefreshToken({ userId: user.id });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await saveRefreshToken(user.id, refreshToken, expiresAt);

    res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar, reputation: user.reputation },
    });
  }),
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.body?.refreshToken;
    if (!token) throw new ApiError(400, "refreshToken required");
    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch {
      throw new ApiError(401, "Invalid refresh token");
    }

    const tokenHash = sha256(token);
    const [rows] = await pool.query(
      "SELECT id, user_id, revoked_at, expires_at FROM auth_tokens WHERE token_hash = ? LIMIT 1",
      [tokenHash],
    );
    const row = rows[0];
    if (!row || row.revoked_at || new Date(row.expires_at).getTime() < Date.now() || row.user_id !== decoded.userId) {
      throw new ApiError(401, "Invalid refresh token");
    }

    const accessToken = signAccessToken({ userId: decoded.userId });
    const nextRefreshToken = signRefreshToken({ userId: decoded.userId });
    await pool.query("UPDATE auth_tokens SET revoked_at = NOW() WHERE id = ?", [row.id]);
    await saveRefreshToken(decoded.userId, nextRefreshToken, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

    res.json({ accessToken, refreshToken: nextRefreshToken });
  }),
);

router.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    const token = req.body?.refreshToken;
    if (token) {
      await pool.query("UPDATE auth_tokens SET revoked_at = NOW() WHERE token_hash = ?", [sha256(token)]);
    }
    res.json({ success: true });
  }),
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      "SELECT id, email, name, avatar, reputation, bio, location, website, created_at FROM users WHERE id = ? LIMIT 1",
      [req.user.userId],
    );
    if (!rows.length) throw new ApiError(404, "User not found");
    res.json(rows[0]);
  }),
);

export default router;