import { runMigrations } from "./lib/migrate-core.js";

runMigrations().catch((error) => {
  console.error(error);
  process.exit(1);
});
