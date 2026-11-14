import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { Adapter } from "next-auth/adapters";
import { prisma } from "./helpers";

// The auth adapter is built from the generated Prisma client through a type cast, so these
// tests drive the real adapter against the real client: the OAuth account-linking path that
// GitHub sign-in uses.
// The shared setup mocks "@/lib/auth", so load the real module to get the shipped adapter.
const { authOptions } = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
const adapter = authOptions.adapter as Required<Adapter>;

describe("auth adapter on the generated Prisma client", () => {
  it("creates a user, links a provider account, and finds the user from it", async () => {
    const email = `oauth-${randomUUID().slice(0, 8)}@example.com`;
    const created = await adapter.createUser({ email, name: "OAuth User", emailVerified: null });
    expect(created.email).toBe(email);

    await adapter.linkAccount({
      userId: created.id,
      type: "oauth",
      provider: "github",
      providerAccountId: "12345",
      access_token: "not-a-real-token",
    });

    const byAccount = await adapter.getUserByAccount({
      provider: "github",
      providerAccountId: "12345",
    });
    expect(byAccount?.id).toBe(created.id);
    expect((await adapter.getUserByEmail(email))?.id).toBe(created.id);
  });

  it("returns null for an unknown account", async () => {
    const found = await adapter.getUserByAccount({
      provider: "github",
      providerAccountId: "does-not-exist",
    });
    expect(found).toBeNull();
  });

  it("deletes the user and their linked accounts", async () => {
    const created = await adapter.createUser({
      email: `del-${randomUUID().slice(0, 8)}@example.com`,
      emailVerified: null,
    });
    await adapter.linkAccount({
      userId: created.id,
      type: "oauth",
      provider: "github",
      providerAccountId: `acct-${created.id}`,
    });
    await adapter.deleteUser(created.id);
    expect(await prisma.user.findUnique({ where: { id: created.id } })).toBeNull();
    expect(await prisma.account.count({ where: { userId: created.id } })).toBe(0);
  });
});
