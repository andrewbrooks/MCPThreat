import type { PartySide } from "@/lib/taxonomy";

// Pure logic for the risk-acceptance workflow. No Prisma here so it can be shared
// with client components.

export type AcceptanceRequirement = "NONE" | "SINGLE" | "DUAL";

/**
 * How many/what kind of approvals a finding needs to be accepted, given the
 * project policy and the finding severity. DUAL only applies to HIGH/CRITICAL;
 * lower severities fall back to SINGLE.
 */
export function acceptanceRequirement(
  policy: string,
  severity: string,
): AcceptanceRequirement {
  if (policy === "OFF") return "NONE";
  if (policy === "SINGLE") return "SINGLE";
  // DUAL
  return severity === "CRITICAL" || severity === "HIGH" ? "DUAL" : "SINGLE";
}

/** The party side a user acts as within a project (the owner is always ASSESSOR). */
export function resolveSide(
  ownerId: string,
  members: { userId: string | null; email: string; side: string }[],
  user: { id: string | null; email?: string | null },
): PartySide {
  if (user.id && user.id === ownerId) return "ASSESSOR";
  const email = user.email?.toLowerCase();
  const m = members.find(
    (x) => (user.id && x.userId === user.id) || (email && x.email.toLowerCase() === email),
  );
  return (m?.side as PartySide) ?? "ASSESSOR";
}

export interface AcceptanceState {
  requireBothSides: boolean;
  assessorApprovedAt: Date | string | null;
  clientApprovedAt: Date | string | null;
}

/** Whether a pending request has collected all required sign-offs. */
export function isAcceptanceComplete(req: AcceptanceState): boolean {
  if (req.requireBothSides) {
    return Boolean(req.assessorApprovedAt) && Boolean(req.clientApprovedAt);
  }
  // SINGLE: any one side signed off is enough.
  return Boolean(req.assessorApprovedAt) || Boolean(req.clientApprovedAt);
}

/** Short human summary of which sign-offs a pending request still needs. */
export function pendingSummary(req: AcceptanceState): string {
  if (req.requireBothSides) {
    const need: string[] = [];
    if (!req.assessorApprovedAt) need.push("assessor");
    if (!req.clientApprovedAt) need.push("client");
    return need.length ? `Awaiting ${need.join(" + ")} sign-off` : "All sign-offs collected";
  }
  return isAcceptanceComplete(req) ? "Approved" : "Awaiting one approval";
}
