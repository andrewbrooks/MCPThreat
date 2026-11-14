import { afterEach, beforeAll, vi } from "vitest";
import { signInAs } from "./session";

// Replace only the session lookup. Route handlers call these three helpers.
vi.mock("@/lib/auth", async () => {
  const { session } = await import("./session");
  return {
    auth: async () =>
      session.userId ? { user: { id: session.userId, email: session.email } } : null,
    currentUserId: async () => session.userId,
    currentActor: async () => ({
      id: session.userId,
      label: session.email ?? "unknown",
    }),
    authOptions: {},
  };
});

beforeAll(() => {
  // Safety net: never run against a real database, only the throwaway one.
  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("mcpthreat-it-")) {
    throw new Error(`Refusing to run integration tests against ${url || "an unset DATABASE_URL"}.`);
  }
});

afterEach(() => signInAs(null));
