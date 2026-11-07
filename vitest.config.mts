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
    // bcrypt hashing is deliberately slow; on a loaded laptop (dev server,
    // browser, another session) a single test can take past 5s and time out
    // even though nothing is wrong. 15s keeps the suite reliable.
    testTimeout: 15000,
    env: {
      DATABASE_URL: "file:./prisma/test.db",
    },
    globalSetup: ["./tests/global-setup.ts"],
  },
});
