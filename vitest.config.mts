import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Tests share one SQLite file, so they must not run in parallel.
    fileParallelism: false,
    env: {
      DATABASE_URL: "file:./prisma/test.db",
    },
    globalSetup: ["./tests/global-setup.ts"],
  },
});
