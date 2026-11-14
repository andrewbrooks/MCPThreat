import type { PartySide } from "@/lib/taxonomy";
import type { SnapshotRequirement, SnapshotStatus } from "@/lib/workflow-types";

// Pure sign-off rules for assessment snapshots. No Prisma, so client components can
// share them. The shape follows the risk-acceptance workflow (see acceptance.ts) but
// applies to a whole snapshot rather than a single finding.

/** What a snapshot needs, fixed at issue time from the project's acceptance policy. */
export function snapshotRequirement(policy: string): SnapshotRequirement {
  if (policy === "SINGLE") return "SINGLE";
  if (policy === "DUAL") return "DUAL";
  return "NONE";
}

export interface SignoffLike {
  side: string;
  decision: string;
  userId?: string | null;
}

/** Derive the status from the recorded decisions. A single return is final. */
export function snapshotStatus(
  requirement: SnapshotRequirement,
  signoffs: SignoffLike[],
): SnapshotStatus {
  if (requirement === "NONE") return "ISSUED";
  if (signoffs.some((s) => s.decision === "RETURNED")) return "RETURNED";
  const approved = signoffs.filter((s) => s.decision === "APPROVED");
  if (requirement === "SINGLE") return approved.length > 0 ? "APPROVED" : "PENDING";
  const sides = new Set(approved.map((s) => s.side));
  return sides.has("ASSESSOR") && sides.has("CLIENT") ? "APPROVED" : "PENDING";
}

/** Sides still needed, lower case, while the snapshot is pending. */
export function awaitingSides(
  requirement: SnapshotRequirement,
  signoffs: SignoffLike[],
): string[] {
  if (snapshotStatus(requirement, signoffs) !== "PENDING") return [];
  if (requirement === "SINGLE") return ["a reviewer other than the issuer"];
  const sides = new Set(signoffs.filter((s) => s.decision === "APPROVED").map((s) => s.side));
  return (["ASSESSOR", "CLIENT"] as const).filter((s) => !sides.has(s)).map((s) => s.toLowerCase());
}

export function statusLabel(status: SnapshotStatus): string {
  switch (status) {
    case "ISSUED":
      return "Issued";
    case "PENDING":
      return "Awaiting sign-off";
    case "APPROVED":
      return "Approved";
    case "RETURNED":
      return "Returned for changes";
  }
}

export interface SignoffViewer {
  userId: string | null;
  side: PartySide;
}

/**
 * Whether a viewer may record a decision now, and if not, why. SINGLE blocks the
 * issuer (four eyes). DUAL fills one slot per side. Each person decides once.
 */
export function canSignOff(
  requirement: SnapshotRequirement,
  signoffs: SignoffLike[],
  viewer: SignoffViewer,
  issuerId: string | null,
): { ok: true } | { ok: false; reason: string } {
  if (requirement === "NONE") {
    return { ok: false, reason: "This snapshot does not require sign-off under the project policy." };
  }
  const status = snapshotStatus(requirement, signoffs);
  if (status === "APPROVED") return { ok: false, reason: "This snapshot is already approved." };
  if (status === "RETURNED") {
    return { ok: false, reason: "This snapshot was returned. Issue a new snapshot after making changes." };
  }
  if (viewer.userId && signoffs.some((s) => s.userId === viewer.userId)) {
    return { ok: false, reason: "You have already recorded a decision on this snapshot." };
  }
  if (requirement === "SINGLE") {
    if (viewer.userId && issuerId && viewer.userId === issuerId) {
      return {
        ok: false,
        reason: "A different person must review a snapshot you issued (four-eyes principle).",
      };
    }
    return { ok: true };
  }
  const filled = signoffs.some((s) => s.decision === "APPROVED" && s.side === viewer.side);
  if (filled) {
    return {
      ok: false,
      reason: `The ${viewer.side.toLowerCase()} sign-off is already recorded. The other side must review next.`,
    };
  }
  return { ok: true };
}
