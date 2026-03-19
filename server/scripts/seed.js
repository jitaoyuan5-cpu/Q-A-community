import { runSeed } from "./lib/seed-core.js";

runSeed().catch((error) => {
  console.error(error);
  process.exit(1);
});
