import { count, findingDisplayIds } from "@/lib/assessment";
import { isOpenStatus } from "@/lib/metrics";
import { resolveSide } from "@/lib/acceptance";
import { canSignOff, snapshotStatus } from "@/lib/signoff";
import type { SnapshotRequirement, WorklistItem } from "@/lib/workflow-types";

// Pure worklist rules. The loader fetches rows; everything decided here is testable
// without a database.

export const DUE_SOON_DAYS = 14;
export const EXPIRING_DAYS = 30;
const DAY_MS = 86_400_000;

export interface WorklistViewer {
  userId: string;
  email: string | null;
}

export interface WorklistFinding {
  id: string;
  title: string;
  severity: string;
  status: string;
  owner: string;
  dueDate: Date | null;
  reviewDueAt: Date | null;
  createdAt: Date;
  /** Latest acceptance request, if any. */
  acceptance: {
    status: string;
    requireBothSides: boolean;
    requestedById: string | null;
    assessorApprovedAt: Date | null;
    clientApprovedAt: Date | null;
  } | null;
}

export interface WorklistSnapshot {
  id: string;
  version: number;
  requirement: string;
  createdById: string | null;
  signoffs: { side: string; decision: string; userId: string | null }[];
}

export interface WorklistProject {
  id: string;
  name: string;
  ownerId: string;
  status: string;
  members: { userId: string | null; email: string; role: string; side: string }[];
  findings: WorklistFinding[];
  /** Any order; the highest version is treated as the latest. */
  snapshots: WorklistSnapshot[];
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function ownsFinding(owner: string, email: string | null): boolean {
  if (!email) return false;
  const o = owner.trim().toLowerCase();
  const e = email.trim().toLowerCase();
  return o !== "" && (o === e || o.includes(`<${e}>`));
}

/** What every item rule needs to know about one project and the person looking at it. */
interface ProjectContext {
  project: WorklistProject;
  viewer: WorklistViewer;
  email: string | null;
  nowMs: number;
  isOwner: boolean;
  /** The viewer's party in this project. */
  side: ReturnType<typeof resolveSide>;
  base: { projectId: string; projectName: string };
  label: (f: WorklistFinding) => string;
  findingsHref: string;
  reviewHref: string;
}

/** The viewer's context for a project, or null when they should not see it (archived, not
 *  involved, or a read-only viewer). */
function projectContext(
  p: WorklistProject,
  viewer: WorklistViewer,
  email: string | null,
  nowMs: number,
): ProjectContext | null {
  if (p.status === "ARCHIVED") return null;
  const isOwner = p.ownerId === viewer.userId;
  const member = p.members.find(
    (m) => (m.userId && m.userId === viewer.userId) || (email && m.email.toLowerCase() === email),
  );
  if (!isOwner && !member) return null;
  if (!isOwner && member?.role === "VIEWER") return null;

  const labels = findingDisplayIds(p.findings);
  return {
    project: p,
    viewer,
    email,
    nowMs,
    isOwner,
    side: resolveSide(p.ownerId, p.members, { id: viewer.userId, email }),
    base: { projectId: p.id, projectName: p.name },
    label: (f) => `${labels.get(f.id) ?? "F-???"} ${f.title}`,
    findingsHref: `/projects/${p.id}/findings`,
    reviewHref: `/projects/${p.id}/review`,
  };
}

/** An open finding the viewer owns that is overdue or due within DUE_SOON_DAYS. */
function deadlineItem(ctx: ProjectContext, f: WorklistFinding, mine: boolean): WorklistItem | null {
  if (!(mine && isOpenStatus(f.status) && f.dueDate)) return null;
  const diff = f.dueDate.getTime() - ctx.nowMs;
  if (diff < 0) {
    const days = Math.floor(-diff / DAY_MS);
    return {
      ...ctx.base,
      id: `FINDING_OVERDUE:${f.id}`,
      kind: "FINDING_OVERDUE",
      title: ctx.label(f),
      detail:
        days >= 1
          ? `Due ${isoDay(f.dueDate)}, ${count(days, "day")} overdue`
          : `Due ${isoDay(f.dueDate)}, now overdue`,
      dueDate: f.dueDate.toISOString(),
      href: ctx.findingsHref,
      priority: 1,
    };
  }
  if (diff <= DUE_SOON_DAYS * DAY_MS) {
    const days = Math.ceil(diff / DAY_MS);
    return {
      ...ctx.base,
      id: `FINDING_DUE_SOON:${f.id}`,
      kind: "FINDING_DUE_SOON",
      title: ctx.label(f),
      detail: `Due ${isoDay(f.dueDate)}, in ${count(days, "day")}`,
      dueDate: f.dueDate.toISOString(),
      href: ctx.findingsHref,
      priority: 2,
    };
  }
  return null;
}

/** A pending risk acceptance the viewer is the one expected to sign off. */
function acceptanceItem(ctx: ProjectContext, f: WorklistFinding): WorklistItem | null {
  const a = f.acceptance;
  if (!a || a.status !== "PENDING") return null;
  const open = a.requireBothSides
    ? ctx.side === "CLIENT"
      ? !a.clientApprovedAt
      : !a.assessorApprovedAt
    : !a.assessorApprovedAt &&
      !a.clientApprovedAt &&
      !(a.requestedById && a.requestedById === ctx.viewer.userId);
  if (!open) return null;
  return {
    ...ctx.base,
    id: `ACCEPTANCE_AWAITING_ME:${f.id}`,
    kind: "ACCEPTANCE_AWAITING_ME",
    title: ctx.label(f),
    detail: a.requireBothSides
      ? `Risk acceptance needs your ${ctx.side === "CLIENT" ? "client" : "assessor"} sign-off`
      : "Risk acceptance needs your approval",
    dueDate: f.dueDate ? f.dueDate.toISOString() : null,
    href: ctx.findingsHref,
    priority: 1,
  };
}

/** An accepted risk whose review date is within EXPIRING_DAYS, for the owner or finding owner. */
function expiringItem(ctx: ProjectContext, f: WorklistFinding, mine: boolean): WorklistItem | null {
  if (!(
    f.status === "ACCEPTED" &&
    f.reviewDueAt &&
    f.reviewDueAt.getTime() <= ctx.nowMs + EXPIRING_DAYS * DAY_MS &&
    (ctx.isOwner || mine)
  )) {
    return null;
  }
  const diff = f.reviewDueAt.getTime() - ctx.nowMs;
  return {
    ...ctx.base,
    id: `ACCEPTANCE_EXPIRING:${f.id}`,
    kind: "ACCEPTANCE_EXPIRING",
    title: ctx.label(f),
    detail:
      diff < 0
        ? `Acceptance review was due ${isoDay(f.reviewDueAt)}`
        : `Acceptance review due ${isoDay(f.reviewDueAt)}, in ${count(Math.ceil(diff / DAY_MS), "day")}`,
    dueDate: f.reviewDueAt.toISOString(),
    href: ctx.findingsHref,
    priority: 2,
  };
}

/** One item per project that has open findings with no owner. */
function unownedItem(ctx: ProjectContext): WorklistItem | null {
  const p = ctx.project;
  const unowned = p.findings.filter((f) => isOpenStatus(f.status) && f.owner.trim() === "").length;
  if (unowned === 0) return null;
  return {
    ...ctx.base,
    id: `FINDING_UNOWNED:${p.id}`,
    kind: "FINDING_UNOWNED",
    title: `${count(unowned, "open finding")} with no owner`,
    detail: "Assign an owner so each finding can be followed up",
    dueDate: null,
    href: ctx.findingsHref,
    priority: 3,
  };
}

/** The latest snapshot, if the viewer should sign it off or it was returned to them. */
function snapshotItem(ctx: ProjectContext): WorklistItem | null {
  const latest = [...ctx.project.snapshots].sort((x, y) => y.version - x.version)[0];
  if (!latest) return null;
  const req = (latest.requirement as SnapshotRequirement) ?? "NONE";
  const status = snapshotStatus(req, latest.signoffs);
  if (status === "PENDING") {
    const can = canSignOff(
      req,
      latest.signoffs,
      { userId: ctx.viewer.userId, side: ctx.side },
      latest.createdById,
    );
    if (!can.ok) return null;
    return {
      ...ctx.base,
      id: `SNAPSHOT_AWAITING_ME:${latest.id}`,
      kind: "SNAPSHOT_AWAITING_ME",
      title: `Snapshot v${latest.version} awaits your sign-off`,
      detail: "Review the frozen assessment and approve it or return it with comments",
      dueDate: null,
      href: ctx.reviewHref,
      priority: 1,
    };
  }
  if (status === "RETURNED" && latest.createdById && latest.createdById === ctx.viewer.userId) {
    return {
      ...ctx.base,
      id: `SNAPSHOT_RETURNED:${latest.id}`,
      kind: "SNAPSHOT_RETURNED",
      title: `Snapshot v${latest.version} was returned for changes`,
      detail: "Address the reviewer's comments, then issue a new snapshot",
      dueDate: null,
      href: ctx.reviewHref,
      priority: 1,
    };
  }
  return null;
}

/** Everything in one project that needs the viewer's attention, in the order rules fire. */
function projectItems(ctx: ProjectContext): WorklistItem[] {
  const items: (WorklistItem | null)[] = [];
  for (const f of ctx.project.findings) {
    const mine = ownsFinding(f.owner, ctx.email);
    items.push(deadlineItem(ctx, f, mine), acceptanceItem(ctx, f), expiringItem(ctx, f, mine));
  }
  items.push(unownedItem(ctx), snapshotItem(ctx));
  return items.filter((i): i is WorklistItem => i !== null);
}

export function buildWorklist(
  projects: WorklistProject[],
  viewer: WorklistViewer,
  now: Date,
): WorklistItem[] {
  const email = viewer.email?.trim().toLowerCase() ?? null;
  const items = projects.flatMap((p) => {
    const ctx = projectContext(p, viewer, email, now.getTime());
    return ctx ? projectItems(ctx) : [];
  });

  return items.sort(
    (a, b) =>
      a.priority - b.priority ||
      (a.dueDate === null ? 1 : 0) - (b.dueDate === null ? 1 : 0) ||
      (a.dueDate ?? "").localeCompare(b.dueDate ?? "") ||
      a.title.localeCompare(b.title),
  );
}
