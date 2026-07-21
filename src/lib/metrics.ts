import {
  RESOLVED_STATUSES,
  SEVERITY_RANK,
  type FindingStatus,
  type Severity,
} from "@/lib/taxonomy";

// All progress and severity numbers are computed here at read time and never stored.

interface FindingLike {
  status: string;
  severity: string;
  threatVectorId: string;
}
interface VectorLike {
  id: string;
}

const OPEN_STATUSES: FindingStatus[] = ["OPEN", "IN_PROGRESS", "PENDING_ACCEPTANCE"];

function isResolved(status: string): boolean {
  return (RESOLVED_STATUSES as string[]).includes(status);
}

/**
 * Completion % = share of threat vectors that have at least one MITIGATED/CLOSED finding.
 * A model with no vectors is 0% complete.
 */
export function completionPct(vectors: VectorLike[], findings: FindingLike[]): number {
  if (vectors.length === 0) return 0;
  const resolvedVectorIds = new Set(
    findings.filter((f) => isResolved(f.status)).map((f) => f.threatVectorId),
  );
  const covered = vectors.filter((v) => resolvedVectorIds.has(v.id)).length;
  return Math.round((covered / vectors.length) * 100);
}

export function isOpenStatus(status: string): boolean {
  return (OPEN_STATUSES as string[]).includes(status);
}

/** Count of findings that are still OPEN or IN_PROGRESS. */
export function openFindingCount(findings: FindingLike[]): number {
  return findings.filter((f) => isOpenStatus(f.status)).length;
}

/** Open-finding counts per severity, for dashboard breakdown badges. */
export function openSeverityBreakdown(
  findings: FindingLike[],
): Record<Severity, number> {
  const out: Record<Severity, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0,
  };
  for (const f of findings) {
    if (isOpenStatus(f.status) && f.severity in out) {
      out[f.severity as Severity] += 1;
    }
  }
  return out;
}

/** Counts across every finding status, for mitigation summaries. */
export function statusBreakdown(findings: FindingLike[]): Record<FindingStatus, number> {
  const out: Record<FindingStatus, number> = {
    OPEN: 0,
    IN_PROGRESS: 0,
    PENDING_ACCEPTANCE: 0,
    MITIGATED: 0,
    ACCEPTED: 0,
    CLOSED: 0,
  };
  for (const f of findings) {
    if (f.status in out) out[f.status as FindingStatus] += 1;
  }
  return out;
}

export function sortBySeverityDesc<T extends { severity: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      (SEVERITY_RANK[b.severity as Severity] ?? 0) -
      (SEVERITY_RANK[a.severity as Severity] ?? 0),
  );
}

/**
 * Workspace step completion, given the model's boundaries/vectors/findings.
 * Step 1: >=1 boundary. Step 2: >=1 vector. Step 3: >=1 finding.
 * Step 4: every finding has an owner assigned (review complete).
 */
export function workspaceSteps(
  boundaryCount: number,
  vectorCount: number,
  findings: { owner: string }[],
): boolean[] {
  const step1 = boundaryCount > 0;
  const step2 = vectorCount > 0;
  const step3 = findings.length > 0;
  const step4 = findings.length > 0 && findings.every((f) => f.owner.trim().length > 0);
  return [step1, step2, step3, step4];
}
