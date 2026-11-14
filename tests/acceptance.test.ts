import { describe, expect, it } from "vitest";
import { acceptanceRequirement, isAcceptanceComplete, resolveSide } from "@/lib/acceptance";

// A fixed sign-off time. The logic only checks that a timestamp is present, so the tests
// must not depend on the current time.
const SIGNED_AT = new Date("2026-01-01T00:00:00.000Z");

describe("acceptanceRequirement", () => {
  it("OFF needs no approval", () => {
    expect(acceptanceRequirement("OFF", "CRITICAL")).toBe("NONE");
  });

  it("SINGLE always needs one approval", () => {
    expect(acceptanceRequirement("SINGLE", "LOW")).toBe("SINGLE");
    expect(acceptanceRequirement("SINGLE", "CRITICAL")).toBe("SINGLE");
  });

  it("DUAL is severity-gated: HIGH/CRITICAL need both sides, else SINGLE", () => {
    expect(acceptanceRequirement("DUAL", "CRITICAL")).toBe("DUAL");
    expect(acceptanceRequirement("DUAL", "HIGH")).toBe("DUAL");
    expect(acceptanceRequirement("DUAL", "MEDIUM")).toBe("SINGLE");
    expect(acceptanceRequirement("DUAL", "LOW")).toBe("SINGLE");
  });
});

describe("resolveSide", () => {
  const members = [
    { userId: "u-client", email: "client@x.com", side: "CLIENT" },
    { userId: null, email: "invited@x.com", side: "ASSESSOR" },
  ];

  it("the owner is always ASSESSOR", () => {
    expect(resolveSide("owner-1", members, { id: "owner-1" })).toBe("ASSESSOR");
  });

  it("resolves a member by user id", () => {
    expect(resolveSide("owner-1", members, { id: "u-client" })).toBe("CLIENT");
  });

  it("resolves a not-yet-registered member by email (case-insensitive)", () => {
    expect(resolveSide("owner-1", members, { id: null, email: "INVITED@x.com" })).toBe("ASSESSOR");
  });

  it("defaults to ASSESSOR for an unknown user", () => {
    expect(resolveSide("owner-1", members, { id: "stranger" })).toBe("ASSESSOR");
  });
});

describe("isAcceptanceComplete", () => {
  it("SINGLE completes on any one sign-off", () => {
    expect(
      isAcceptanceComplete({
        requireBothSides: false,
        assessorApprovedAt: SIGNED_AT,
        clientApprovedAt: null,
      }),
    ).toBe(true);
    expect(
      isAcceptanceComplete({
        requireBothSides: false,
        assessorApprovedAt: null,
        clientApprovedAt: null,
      }),
    ).toBe(false);
  });

  it("DUAL requires both sides", () => {
    expect(
      isAcceptanceComplete({
        requireBothSides: true,
        assessorApprovedAt: SIGNED_AT,
        clientApprovedAt: null,
      }),
    ).toBe(false);
    expect(
      isAcceptanceComplete({
        requireBothSides: true,
        assessorApprovedAt: SIGNED_AT,
        clientApprovedAt: SIGNED_AT,
      }),
    ).toBe(true);
  });
});
