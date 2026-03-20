import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, "../../uploads");

const schema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
  dataBase64: z.string().min(20),
});

const extByMime = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const router = Router();

router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = schema.parse(req.body);
    const buffer = Buffer.from(payload.dataBase64, "base64");
    if (!buffer.length || buffer.length > 2 * 1024 * 1024) {
      return res.status(400).json({ message: "Invalid file size" });
    }

    await mkdir(uploadsDir, { recursive: true });
    const storedName = `${Date.now()}-${req.user.userId}-${Math.random().toString(36).slice(2, 10)}${extByMime[payload.mimeType]}`;
    await writeFile(path.join(uploadsDir, storedName), buffer);
    const url = `${req.protocol}://${req.get("host")}/uploads/${storedName}`;

    const [result] = await pool.query(
      `INSERT INTO uploads (user_id, original_name, stored_name, mime_type, size_bytes, url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.userId, payload.fileName, storedName, payload.mimeType, buffer.length, url],
    );

    res.status(201).json({
      id: result.insertId,
      fileName: payload.fileName,
      mimeType: payload.mimeType,
      sizeBytes: buffer.length,
      url,
    });
  }),
);

export default router;
