import { describe, expect, it } from "vitest";
import { awaitingSides, canSignOff, snapshotRequirement, snapshotStatus } from "@/lib/signoff";

const ok = (side: string, userId = "u") => ({ side, decision: "APPROVED", userId });
const ret = (side: string, userId = "u") => ({ side, decision: "RETURNED", userId });

describe("snapshotRequirement", () => {
  it("follows the project policy", () => {
    expect(snapshotRequirement("OFF")).toBe("NONE");
    expect(snapshotRequirement("SINGLE")).toBe("SINGLE");
    expect(snapshotRequirement("DUAL")).toBe("DUAL");
    expect(snapshotRequirement("anything-else")).toBe("NONE");
  });
});

describe("snapshotStatus", () => {
  it("is Issued when no review is required", () => {
    expect(snapshotStatus("NONE", [])).toBe("ISSUED");
  });
  it("SINGLE: pending, then approved by one approval", () => {
    expect(snapshotStatus("SINGLE", [])).toBe("PENDING");
    expect(snapshotStatus("SINGLE", [ok("CLIENT")])).toBe("APPROVED");
  });
  it("DUAL needs both sides", () => {
    expect(snapshotStatus("DUAL", [ok("ASSESSOR")])).toBe("PENDING");
    expect(snapshotStatus("DUAL", [ok("ASSESSOR", "a"), ok("ASSESSOR", "b")])).toBe("PENDING");
    expect(snapshotStatus("DUAL", [ok("ASSESSOR", "a"), ok("CLIENT", "b")])).toBe("APPROVED");
  });
  it("a return is final even after approvals", () => {
    expect(snapshotStatus("DUAL", [ok("ASSESSOR", "a"), ret("CLIENT", "b")])).toBe("RETURNED");
    expect(snapshotStatus("SINGLE", [ret("CLIENT")])).toBe("RETURNED");
  });
});

describe("awaitingSides", () => {
  it("lists the missing sides while pending", () => {
    expect(awaitingSides("DUAL", [])).toEqual(["assessor", "client"]);
    expect(awaitingSides("DUAL", [ok("CLIENT")])).toEqual(["assessor"]);
  });
  it("is empty once decided or when none required", () => {
    expect(awaitingSides("NONE", [])).toEqual([]);
    expect(awaitingSides("SINGLE", [ok("CLIENT")])).toEqual([]);
    expect(awaitingSides("DUAL", [ret("CLIENT")])).toEqual([]);
  });
});

describe("canSignOff", () => {
  const viewer = (userId: string, side: "ASSESSOR" | "CLIENT") => ({ userId, side });

  it("refuses when no sign-off is required", () => {
    expect(canSignOff("NONE", [], viewer("a", "CLIENT"), "x").ok).toBe(false);
  });
  it("SINGLE blocks the issuer but allows another person on either side", () => {
    expect(canSignOff("SINGLE", [], viewer("issuer", "ASSESSOR"), "issuer").ok).toBe(false);
    expect(canSignOff("SINGLE", [], viewer("other", "ASSESSOR"), "issuer").ok).toBe(true);
    expect(canSignOff("SINGLE", [], viewer("c", "CLIENT"), "issuer").ok).toBe(true);
  });
  it("DUAL fills one slot per side and allows the issuer", () => {
    expect(canSignOff("DUAL", [], viewer("issuer", "ASSESSOR"), "issuer").ok).toBe(true);
    const r = canSignOff("DUAL", [ok("ASSESSOR", "a")], viewer("b", "ASSESSOR"), "issuer");
    expect(r.ok).toBe(false);
    expect(canSignOff("DUAL", [ok("ASSESSOR", "a")], viewer("c", "CLIENT"), "issuer").ok).toBe(true);
  });
  it("each person decides once", () => {
    const r = canSignOff("DUAL", [ok("ASSESSOR", "a")], viewer("a", "ASSESSOR"), "issuer");
    expect(r.ok).toBe(false);
  });
  it("is closed once approved or returned", () => {
    expect(canSignOff("SINGLE", [ok("CLIENT", "c")], viewer("d", "CLIENT"), "i").ok).toBe(false);
    expect(canSignOff("SINGLE", [ret("CLIENT", "c")], viewer("d", "CLIENT"), "i").ok).toBe(false);
  });
});
