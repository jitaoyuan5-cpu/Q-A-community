import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { asyncHandler } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";
import { parseJsonField } from "../utils/json.js";

const router = Router();

const templates = [
  {
    key: "html",
    label: "HTML / CSS / JS",
    files: {
      "index.html": "<main>\n  <h1>Hello playground</h1>\n  <p>Edit HTML, CSS and JS, then run.</p>\n</main>",
      "styles.css": "body { font-family: sans-serif; padding: 24px; background: #f8fafc; }",
      "script.js": "document.querySelector('h1')?.addEventListener('click', () => console.log('clicked'));\n",
    },
  },
  {
    key: "typescript",
    label: "TypeScript",
    files: {
      "index.ts": "type User = { name: string; score: number };\nconst user: User = { name: 'Alice', score: 42 };\nconsole.log(user);\n",
    },
  },
  {
    key: "react",
    label: "React TSX",
    files: {
      "App.tsx": "import React from \"react\";\nimport { createRoot } from \"react-dom/client\";\nfunction App() {\n  const [count, setCount] = React.useState(0);\n  return <button onClick={() => setCount((value) => value + 1)}>count: {count}</button>;\n}\ncreateRoot(document.getElementById(\"root\")!).render(<App />);\n",
    },
  },
];

const shareSchema = z.object({
  title: z.string().min(1).max(255),
  templateKey: z.enum(["html", "typescript", "react"]),
  files: z.record(z.string(), z.string()).refine((value) => Object.keys(value).length > 0, "At least one file is required"),
});

router.get(
  "/templates",
  asyncHandler(async (_req, res) => {
    res.json(templates);
  }),
);

router.get(
  "/shares/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [rows] = await pool.query("SELECT id, title, template_key, files_json, created_at FROM playground_shares WHERE id = ? LIMIT 1", [id]);
    if (!rows.length) return res.status(404).json({ message: "Share not found" });
    res.json({
      id: rows[0].id,
      title: rows[0].title,
      templateKey: rows[0].template_key,
      files: parseJsonField(rows[0].files_json, {}),
      createdAt: rows[0].created_at,
    });
  }),
);

router.post(
  "/shares",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = shareSchema.parse(req.body);
    const [result] = await pool.query(
      "INSERT INTO playground_shares (user_id, title, template_key, files_json) VALUES (?, ?, ?, ?)",
      [req.user.userId, payload.title, payload.templateKey, JSON.stringify(payload.files)],
    );
    res.status(201).json({ id: result.insertId });
  }),
);

export default router;
