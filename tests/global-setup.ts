import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

/**
 * Build a fresh test database before the suite runs. The development database
 * (`prisma/dev.db`) is never touched.
 */
export default function setup() {
  const projectRoot = path.resolve(import.meta.dirname, "..");
  const testDatabase = path.join(projectRoot, "prisma", "test.db");

  rmSync(testDatabase, { force: true });
  rmSync(`${testDatabase}-journal`, { force: true });

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: projectRoot,
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: "file:./prisma/test.db" },
  });
}
