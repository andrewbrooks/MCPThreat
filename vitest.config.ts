import path from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests cover the pure, security-critical logic (risk scoring, the
// acceptance state machine, SSRF/host-lock guards, dataflow parsing, metrics).
// The "@/..." alias mirrors tsconfig so tests import modules the same way the app does.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(process.cwd(), "src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration tests need a database; run them with `npm run test:integration`.
    exclude: ["tests/integration/**", "node_modules/**"],
  },
});
