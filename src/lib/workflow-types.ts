// Shared contracts for the workflow layer (stages, readiness, worklist, snapshots).
// Types only, no runtime code, so server and client components can both import them.
// Several modules implement against these; change them deliberately.

// ---------------------------------------------------------------------------
// Stages and readiness
// ---------------------------------------------------------------------------

/** The five stages a threat model moves through. Order matters. */
export const STAGE_KEYS = ["SCOPE", "MODEL", "ASSESS", "REMEDIATE", "SIGN_OFF"] as const;
export type StageKey = (typeof STAGE_KEYS)[number];

export const STAGE_LABELS: Record<StageKey, string> = {
  SCOPE: "Scope",
  MODEL: "Model",
  ASSESS: "Assess",
  REMEDIATE: "Remediate",
  SIGN_OFF: "Sign off",
};

export const STAGE_DESCRIPTIONS: Record<StageKey, string> = {
  SCOPE: "Describe what is being assessed.",
  MODEL: "Define trust boundaries and the threats that cross them.",
  ASSESS: "Record findings with a severity, rationale and recommendation.",
  REMEDIATE: "Assign owners and dates, and work findings to a decision.",
  SIGN_OFF: "Issue a frozen snapshot and have it reviewed.",
};

export type CheckLevel = "BLOCKER" | "WARNING" | "INFO";

export interface ReadinessCheck {
  /** Stable identifier, e.g. "findings-without-owner". */
  id: string;
  stage: StageKey;
  /** BLOCKER: should be fixed before issuing a snapshot. WARNING: should be reviewed.
   *  INFO: worth knowing. */
  level: CheckLevel;
  passed: boolean;
  /** Short statement, e.g. "3 findings have no owner". Always states the current fact. */
  title: string;
  /** One sentence on why it matters or what to do. */
  detail: string;
  /** How many items fail the check (0 when passed). */
  count: number;
  /** Where to go to fix it, relative to the project: "/findings", "/model", "" (overview). */
  href: string;
}

export type StageStatus = "DONE" | "CURRENT" | "UPCOMING";

export interface StageState {
  key: StageKey;
  label: string;
  description: string;
  status: StageStatus;
  checks: ReadinessCheck[];
  /** Number of failed checks at BLOCKER or WARNING level. */
  outstanding: number;
}

export interface Readiness {
  stages: StageState[];
  /** The first stage with outstanding work, or COMPLETE when the latest snapshot is
   *  decided and the live model has not changed since. */
  currentStage: StageKey | "COMPLETE";
  /** Failed checks in the current stage, BLOCKER first, at most 5. */
  nextActions: ReadinessCheck[];
  /** True when no BLOCKER check fails in the stages before SIGN_OFF. */
  canIssue: boolean;
  /** Whether the live model differs from the latest snapshot. Null when there is none. */
  changedSinceSnapshot: boolean | null;
  latestSnapshot: SnapshotSummary | null;
}

// ---------------------------------------------------------------------------
// Snapshots and sign-off
// ---------------------------------------------------------------------------

export type SnapshotRequirement = "NONE" | "SINGLE" | "DUAL";
/** ISSUED: no review required. PENDING: awaiting sign-off. APPROVED / RETURNED: decided. */
export type SnapshotStatus = "ISSUED" | "PENDING" | "APPROVED" | "RETURNED";

export interface SnapshotSignoffView {
  side: "ASSESSOR" | "CLIENT";
  decision: "APPROVED" | "RETURNED";
  comment: string;
  by: string;
  at: string;
}

export interface SnapshotSummary {
  id: string;
  version: number;
  note: string;
  requirement: SnapshotRequirement;
  status: SnapshotStatus;
  /** A newer snapshot of the same project exists. */
  superseded: boolean;
  /** sha256 of the canonical assessment, hex. */
  contentHash: string;
  createdAt: string;
  createdBy: string;
  signoffs: SnapshotSignoffView[];
  /** Sides still needed while PENDING, e.g. ["assessor", "client"]. Empty otherwise. */
  awaiting: string[];
}

/** Request and response shapes for the snapshot API.
 *   GET  /api/projects/:id/snapshots                      -> { snapshots: SnapshotSummary[] }
 *   POST /api/projects/:id/snapshots   { note? }          -> 201 { snapshot: SnapshotSummary }
 *        409 { error, checks: ReadinessCheck[] } when blocking checks fail
 *   POST /api/projects/:id/snapshots/:sid/signoff
 *        { decision: "APPROVE" | "RETURN", comment? }     -> { snapshot: SnapshotSummary }
 *   GET  /api/projects/:id/snapshots/:sid/report?format=md|html|json|csv[&download=1]
 */
export interface IssueSnapshotBody {
  note?: string;
}
export interface SignoffBody {
  decision: "APPROVE" | "RETURN";
  comment?: string;
}

// ---------------------------------------------------------------------------
// Worklist ("what needs my attention")
// ---------------------------------------------------------------------------

export type WorklistKind =
  | "FINDING_OVERDUE"
  | "FINDING_DUE_SOON"
  | "FINDING_UNOWNED"
  | "ACCEPTANCE_AWAITING_ME"
  | "ACCEPTANCE_EXPIRING"
  | "SNAPSHOT_AWAITING_ME"
  | "SNAPSHOT_RETURNED";

export interface WorklistItem {
  /** Unique within a worklist, e.g. "FINDING_OVERDUE:<findingId>". */
  id: string;
  kind: WorklistKind;
  projectId: string;
  projectName: string;
  /** What needs attention, e.g. "F-003 Webhook URL fetched without allowlist". */
  title: string;
  /** Why, e.g. "Due 2026-11-09, 5 days ago". */
  detail: string;
  dueDate: string | null;
  /** Absolute app path to act on it. */
  href: string;
  /** 1 = act now, 2 = soon, 3 = for awareness. */
  priority: 1 | 2 | 3;
}
