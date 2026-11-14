import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";

// Regression test for a next-auth bug (fixed in 4.24.15): a malformed Bearer token made
// the auth middleware throw, so any unauthenticated request carrying one got a 500 from
// every protected page. It must redirect to sign-in like any other signed-out request.

beforeAll(() => {
  // A repeated character: long enough to be accepted, and plainly not a real secret.
  process.env.NEXTAUTH_SECRET = "a".repeat(48);
  process.env.NEXTAUTH_URL = "http://localhost:3000";
});

async function run(path: string, authorization?: string) {
  const { default: middleware } = await import("@/proxy");
  const request = new NextRequest(`http://localhost:3000${path}`, {
    headers: authorization === undefined ? {} : { authorization },
  });
  // The middleware signature is (request, event); the event is unused for this check.
  return (middleware as unknown as (r: NextRequest, e: unknown) => Promise<Response | undefined>)(
    request,
    {},
  );
}

describe("auth middleware with malformed credentials", () => {
  it("redirects a signed-out request to sign-in", async () => {
    const res = await run("/projects/abc");
    expect(res?.status).toBe(307);
    expect(res?.headers.get("location")).toContain("/login");
  });

  it.each(["Bearer", "Bearer %%%", "Bearer a.b.c", "Bearer %E0%A4%A", `Bearer ${"A".repeat(500)}`])(
    "does not throw on Authorization: %s",
    async (header) => {
      const res = await run("/projects/abc", header);
      expect(res?.status).toBe(307);
      expect(res?.headers.get("location")).toContain("/login");
    },
  );
});
