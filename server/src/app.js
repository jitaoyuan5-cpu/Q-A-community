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
import adminTutorialRoutes from "./routes/admin-tutorials.js";
import assistantRoutes from "./routes/assistant.js";
import questionChatRoutes from "./routes/question-chats.js";
import tutorialRoutes from "./routes/tutorials.js";
import playgroundRoutes from "./routes/playground.js";
import developerRoutes from "./routes/developer.js";
import publicApiRoutes from "./routes/public-api.js";

export const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const allowedOrigins = new Set(env.corsOrigins);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
  }),
);
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
app.use("/api/admin/tutorials", adminTutorialRoutes);
app.use("/api/assistant", assistantRoutes);
app.use("/api/question-chats", questionChatRoutes);
app.use("/api/tutorials", tutorialRoutes);
app.use("/api/playground", playgroundRoutes);
app.use("/api/developer", developerRoutes);
app.use("/api/public/v1", publicApiRoutes);

app.use(notFound);
app.use(errorHandler);
