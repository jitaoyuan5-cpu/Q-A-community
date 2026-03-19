import { verifyAccessToken } from "../utils/crypto.js";

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