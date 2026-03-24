import http from "node:http";
import { env } from "./config/env.js";
import { app } from "./app.js";
import { runMigrations } from "../scripts/lib/migrate-core.js";
import { attachQuestionChatServer } from "./realtime/question-chat.js";

try {
  await runMigrations();
  const server = http.createServer(app);
  attachQuestionChatServer(server);
  server.listen(env.port, () => {
    console.log(`API listening on :${env.port}`);
  });
} catch (error) {
  console.error("Failed to start API:", error);
  process.exit(1);
}
