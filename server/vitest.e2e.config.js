import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/e2e/**/*.e2e.test.js"],
    setupFiles: ["./test/e2e/setup.js"],
    environment: "node",
    globals: true,
    fileParallelism: false,
  },
});

