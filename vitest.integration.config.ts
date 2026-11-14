import path from "node:path";
import { defineConfig } from "vitest/config";

// Integration tests run the real route handlers against a throwaway SQLite database
// (created and migrated in tests/integration/global-setup.ts). Only the login session
// is faked. Run with: npm run test:integration. They are excluded from `npm test`.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(process.cwd(), "src") },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    setupFiles: ["tests/integration/setup.ts"],
    // One shared SQLite file: run test files one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
