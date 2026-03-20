import { env } from "./config/env.js";
import { app } from "./app.js";
import { runMigrations } from "../scripts/lib/migrate-core.js";

try {
  await runMigrations();
  app.listen(env.port, () => {
    console.log(`API listening on :${env.port}`);
  });
} catch (error) {
  console.error("Failed to start API:", error);
  process.exit(1);
}
