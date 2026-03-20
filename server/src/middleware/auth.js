import { verifyAccessToken } from "../utils/crypto.js";
import { pool } from "../db/pool.js";

export const authOptional = (req, _res, next) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    try {
      req.user = verifyAccessToken(token);
    } catch {
      req.user = null;
    }
  }
  next();
};

export const requireAuth = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    req.user = verifyAccessToken(auth.slice(7));
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

export const requireAdmin = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    req.user = verifyAccessToken(auth.slice(7));
    const [rows] = await pool.query("SELECT role FROM users WHERE id = ? LIMIT 1", [req.user.userId]);
    if (!rows.length || rows[0].role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
};
