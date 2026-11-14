import { count, type Assessment, type AssessmentFinding } from "@/lib/assessment";
import {
  STAGE_DESCRIPTIONS,
  STAGE_KEYS,
  STAGE_LABELS,
  type CheckLevel,
  type Readiness,
  type ReadinessCheck,
  type SnapshotSummary,
  type StageKey,
  type StageState,
} from "@/lib/workflow-types";

export interface ReadinessInput {
  assessment: Assessment;
  /** Newest first. */
  snapshots: SnapshotSummary[];
  /** assessmentContentHash of the live assessment. */
  liveHash: string;
  /** assessmentModelHash of the latest snapshot as it was frozen. When omitted, the
   *  latest snapshot's contentHash is compared instead. */
  latestSnapshotModelHash?: string | null;
  now: Date;
}

const DAY_MS = 86_400_000;
const EXPIRY_WINDOW_DAYS = 30;
const LEVEL_ORDER: Record<CheckLevel, number> = { BLOCKER: 0, WARNING: 1, INFO: 2 };
/** Stages whose blockers stop a snapshot being issued. */
const ISSUE_STAGES: StageKey[] = ["SCOPE", "MODEL", "ASSESS", "REMEDIATE"];

const isHigh = (f: AssessmentFinding) => f.severity === "CRITICAL" || f.severity === "HIGH";
const blank = (s: string | null | undefined) => !s || s.trim() === "";

function dueTime(f: AssessmentFinding): number | null {
  if (!f.dueDate) return null;
  const t = Date.parse(f.dueDate);
  return Number.isNaN(t) ? null : t;
}

interface Spec {
  id: string;
  stage: StageKey;
  level: CheckLevel;
  /** Number of failing items. */
  n: number;
  href: string;
  /** Title when failing, given the count. */
  fail: (n: number) => string;
  pass: string;
  detail: string;
}

function check(s: Spec): ReadinessCheck {
  const passed = s.n === 0;
  return {
    id: s.id,
    stage: s.stage,
    level: s.level,
    passed,
    title: passed ? s.pass : s.fail(s.n),
    detail: s.detail,
    count: passed ? 0 : s.n,
    href: s.href,
  };
}

const have = (n: number, one: string, many = `${one}s`) =>
  `${count(n, one, many)} ${n === 1 ? "has" : "have"}`;

export function evaluateReadiness(input: ReadinessInput): Readiness {
  const { assessment: a, snapshots, liveHash, now, latestSnapshotModelHash } = input;
  const nowMs = now.getTime();
  const latest = snapshots[0] ?? null;
  const findings = a.findings;
  const open = findings.filter((f) => f.isOpen);

  const noDescription = blank(a.record.projectDescription) ? 1 : 0;
  const noUrl = blank(a.record.mcpServerUrl) ? 1 : 0;

  const emptyBoundaries = a.boundaries.filter((b) => b.vectorIds.length === 0).length;
  const noBoundaries = a.boundaries.length === 0 ? 1 : 0;
  const noVectors = a.boundaries.length > 0 && a.vectors.length === 0 ? 1 : 0;
  const ai = a.record.aiSuggested;
  const aiCount = ai.boundaries + ai.vectors + ai.findings;

  const unassessed = a.vectors.filter((v) => v.findingIds.length === 0).length;
  const noRationale = findings.filter((f) => blank(f.description)).length;
  const noRecommendation = findings.filter((f) => blank(f.recommendation)).length;
  const noEvidence = findings.filter(
    (f) => isHigh(f) && blank(f.evidence) && f.attachments.length === 0,
  ).length;

  const noOwner = open.filter((f) => blank(f.owner)).length;
  const noDue = open.filter((f) => isHigh(f) && !f.dueDate).length;
  const overdue = open.filter((f) => {
    const t = dueTime(f);
    return t !== null && t < nowMs;
  }).length;
  const openCritical = open.filter((f) => f.severity === "CRITICAL").length;
  const pending = findings.filter((f) => f.status === "PENDING_ACCEPTANCE").length;
  const limit = nowMs + EXPIRY_WINDOW_DAYS * DAY_MS;
  const expiring = findings.filter((f) => {
    if (f.status !== "ACCEPTED" || !f.reviewDueAt) return false;
    const t = Date.parse(f.reviewDueAt);
    return !Number.isNaN(t) && t <= limit;
  }).length;

  const changed = latest ? liveHash !== (latestSnapshotModelHash ?? latest.contentHash) : null;
  const awaitingText = latest?.awaiting.length ? latest.awaiting.join(" and ") : "a reviewer";

  const checks: ReadinessCheck[] = [
    // SCOPE
    check({
      id: "project-description",
      stage: "SCOPE",
      level: "WARNING",
      n: noDescription,
      href: "",
      fail: () => "The project has no description",
      pass: "The project has a description",
      detail: "A short description tells a reader what system this assessment covers.",
    }),
    check({
      id: "mcp-server-url",
      stage: "SCOPE",
      level: "INFO",
      n: noUrl,
      href: "",
      fail: () => "No MCP server URL is recorded",
      pass: "An MCP server URL is recorded",
      detail: "Recording the server URL makes the scope of the assessment unambiguous.",
    }),
    // MODEL
    check({
      id: "has-boundaries",
      stage: "MODEL",
      level: "BLOCKER",
      n: noBoundaries,
      href: "/model",
      fail: () => "The model has no trust boundaries",
      pass: `The model has ${count(a.boundaries.length, "trust boundary", "trust boundaries")}`,
      detail: "Trust boundaries are where data and control cross between components, so start there.",
    }),
    check({
      id: "boundaries-without-vectors",
      stage: "MODEL",
      level: "WARNING",
      n: emptyBoundaries,
      href: "/model",
      fail: (n) => `${have(n, "trust boundary", "trust boundaries")} no threat vectors`,
      pass: "Every trust boundary has threat vectors",
      detail: "Add the threats that apply at each boundary, or remove boundaries that are out of scope.",
    }),
    check({
      id: "has-vectors",
      stage: "MODEL",
      level: "BLOCKER",
      n: noVectors,
      href: "/model",
      fail: () => "The model has no threat vectors",
      pass: `The model has ${count(a.vectors.length, "threat vector")}`,
      detail: "Threat vectors describe what could go wrong at a boundary and are what findings attach to.",
    }),
    check({
      id: "ai-suggested-items",
      stage: "MODEL",
      level: "INFO",
      n: aiCount,
      href: "/model",
      fail: (n) => `${count(n, "AI-suggested item")} to confirm before issuing`,
      pass: "No AI-suggested items are waiting for confirmation",
      detail: "Review each AI-suggested item and keep, edit or delete it so a person stands behind the record.",
    }),
    // ASSESS
    check({
      id: "has-findings",
      stage: "ASSESS",
      level: "BLOCKER",
      n: findings.length === 0 ? 1 : 0,
      href: "/findings",
      fail: () => "No findings are recorded",
      pass: `${count(findings.length, "finding")} recorded`,
      detail: "Record a finding for each threat vector you assess, even where the risk is low.",
    }),
    check({
      id: "vectors-without-findings",
      stage: "ASSESS",
      level: "WARNING",
      n: unassessed,
      href: "/findings",
      fail: (n) => `${have(n, "threat vector")} no finding yet, meaning not assessed`,
      pass: "Every threat vector has at least one finding",
      detail: "A vector with no finding reads as not assessed, so add one even if the conclusion is low risk.",
    }),
    check({
      id: "findings-without-rationale",
      stage: "ASSESS",
      level: "WARNING",
      n: noRationale,
      href: "/findings",
      fail: (n) => `${have(n, "finding")} no rationale`,
      pass: "Every finding has a rationale",
      detail: "The description should explain why the severity was chosen.",
    }),
    check({
      id: "findings-without-recommendation",
      stage: "ASSESS",
      level: "WARNING",
      n: noRecommendation,
      href: "/findings",
      fail: (n) => `${have(n, "finding")} no recommendation`,
      pass: "Every finding has a recommendation",
      detail: "Say what should be done about each finding so owners know the expected fix.",
    }),
    check({
      id: "high-findings-without-evidence",
      stage: "ASSESS",
      level: "WARNING",
      n: noEvidence,
      href: "/findings",
      fail: (n) => `${have(n, "Critical or High finding")} no evidence recorded`,
      pass: "Every Critical or High finding has evidence",
      detail: "Add notes or an attachment showing how the issue was observed.",
    }),
    // REMEDIATE
    check({
      id: "open-findings-without-owner",
      stage: "REMEDIATE",
      level: "WARNING",
      n: noOwner,
      href: "/findings",
      fail: (n) => `${have(n, "open finding")} no owner`,
      pass: "Every open finding has an owner",
      detail: "Name who is responsible so each finding can be chased.",
    }),
    check({
      id: "open-high-findings-without-due-date",
      stage: "REMEDIATE",
      level: "WARNING",
      n: noDue,
      href: "/findings",
      fail: (n) => `${have(n, "open Critical or High finding")} no due date`,
      pass: "Every open Critical or High finding has a due date",
      detail: "Set a target date so serious findings are not left open indefinitely.",
    }),
    check({
      id: "overdue-findings",
      stage: "REMEDIATE",
      level: "WARNING",
      n: overdue,
      href: "/findings",
      fail: (n) => `${have(n, "open finding")} passed its due date`,
      pass: "No open finding is past its due date",
      detail: "Fix these, move the date with a reason, or record a risk acceptance.",
    }),
    check({
      id: "open-critical-findings",
      stage: "REMEDIATE",
      level: "INFO",
      n: openCritical,
      href: "/findings",
      fail: (n) => `${n === 1 ? "1 Critical finding is" : `${n} Critical findings are`} still open`,
      pass: "No Critical finding is open",
      detail: "Reviewers will expect these to be resolved or explicitly accepted.",
    }),
    check({
      id: "acceptances-pending",
      stage: "REMEDIATE",
      level: "INFO",
      n: pending,
      href: "/findings",
      fail: (n) => `${count(n, "finding")} ${n === 1 ? "is" : "are"} pending acceptance`,
      pass: "No findings are waiting for acceptance",
      detail: "These need sign-off under the project policy before they count as accepted.",
    }),
    check({
      id: "acceptances-expiring-soon",
      stage: "REMEDIATE",
      level: "INFO",
      n: expiring,
      href: "/findings",
      fail: (n) =>
        `${count(n, "accepted finding")} ${n === 1 ? "comes" : "come"} up for review within ${EXPIRY_WINDOW_DAYS} days`,
      pass: `No accepted finding is due for review within ${EXPIRY_WINDOW_DAYS} days`,
      detail: "Accepted risks reopen when their review date passes, so revisit them in good time.",
    }),
    // SIGN_OFF
    check({
      id: "snapshot-issued",
      stage: "SIGN_OFF",
      level: "WARNING",
      n: latest ? 0 : 1,
      href: "/review",
      fail: () => "No snapshot has been issued",
      pass: `Snapshot v${latest?.version ?? 0} has been issued`,
      detail: "Issue a snapshot to give reviewers a frozen record that will not change underneath them.",
    }),
    check({
      id: "snapshot-decided",
      stage: "SIGN_OFF",
      level: "WARNING",
      n: latest?.status === "PENDING" ? 1 : 0,
      href: "/review",
      fail: () => `Snapshot v${latest?.version} is awaiting sign-off from ${awaitingText}`,
      pass: "The latest snapshot is not waiting on a review",
      detail: "Ask the reviewers to record a decision on the snapshot.",
    }),
    check({
      id: "snapshot-returned",
      stage: "SIGN_OFF",
      level: "BLOCKER",
      n: latest?.status === "RETURNED" ? 1 : 0,
      href: "/review",
      fail: () => `Snapshot v${latest?.version} was returned for changes`,
      pass: "The latest snapshot has not been returned",
      detail: "Address the reviewer's comments, then issue a new snapshot.",
    }),
    check({
      id: "model-changed-since-snapshot",
      stage: "SIGN_OFF",
      level: "WARNING",
      n: changed === true ? 1 : 0,
      href: "/review",
      fail: () => `The model has changed since snapshot v${latest?.version}`,
      pass: "The model matches the latest snapshot",
      detail: "Issue a new snapshot so the reviewed record matches the current model.",
    }),
  ];

  const stages: StageState[] = [];
  let earlierDone = true;
  let currentStage: StageKey | "COMPLETE" = "COMPLETE";
  for (const key of STAGE_KEYS) {
    const stageChecks = checks.filter((c) => c.stage === key);
    const outstanding = stageChecks.filter((c) => !c.passed && c.level !== "INFO").length;
    const done: boolean = earlierDone && outstanding === 0;
    let status: StageState["status"];
    if (done) status = "DONE";
    else if (earlierDone) {
      status = "CURRENT";
      currentStage = key;
    } else status = "UPCOMING";
    earlierDone = done;
    stages.push({
      key,
      label: STAGE_LABELS[key],
      description: STAGE_DESCRIPTIONS[key],
      status,
      checks: stageChecks,
      outstanding,
    });
  }

  const nextActions =
    currentStage === "COMPLETE"
      ? []
      : checks
          .filter((c) => c.stage === currentStage && !c.passed)
          .sort((x, y) => LEVEL_ORDER[x.level] - LEVEL_ORDER[y.level])
          .slice(0, 5);

  const canIssue = !checks.some(
    (c) => ISSUE_STAGES.includes(c.stage) && c.level === "BLOCKER" && !c.passed,
  );

  return {
    stages,
    currentStage,
    nextActions,
    canIssue,
    changedSinceSnapshot: changed,
    latestSnapshot: latest,
  };
}
