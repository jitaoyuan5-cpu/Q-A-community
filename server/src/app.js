import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./config/env.js";
import { authOptional } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/error.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import questionRoutes from "./routes/questions.js";
import answerRoutes from "./routes/answers.js";
import commentRoutes from "./routes/comments.js";
import followRoutes from "./routes/follows.js";
import searchRoutes from "./routes/search.js";
import metaRoutes from "./routes/meta.js";
import uploadRoutes from "./routes/uploads.js";
import favoriteRoutes from "./routes/favorites.js";
import notificationRoutes from "./routes/notifications.js";
import reportRoutes from "./routes/reports.js";
import adminRoutes from "./routes/admin.js";

export const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: "6mb" }));
app.use(authOptional);
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/answers", answerRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/follows", followRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/meta", metaRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);
