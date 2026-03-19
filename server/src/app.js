import cors from "cors";
import express from "express";
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

export const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: "1mb" }));
app.use(authOptional);

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/answers", answerRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/follows", followRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/meta", metaRoutes);

app.use(notFound);
app.use(errorHandler);