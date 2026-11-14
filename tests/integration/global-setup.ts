import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Creates a temporary SQLite database, applies every migration to it, and points the
// app at it. The path is exported through the environment so test workers inherit it.
export default function setup() {
  const dir = mkdtempSync(path.join(tmpdir(), "mcpthreat-it-"));
  const url = `file:${path.join(dir, "test.db")}`;
  process.env.DATABASE_URL = url;

  const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    rmSync(dir, { recursive: true, force: true });
    throw new Error(`Could not migrate the test database:\n${result.stdout}\n${result.stderr}`);
  }

  return () => rmSync(dir, { recursive: true, force: true });
}
