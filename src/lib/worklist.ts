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

export function buildWorklist(
  projects: WorklistProject[],
  viewer: WorklistViewer,
  now: Date,
): WorklistItem[] {
  const nowMs = now.getTime();
  const items: WorklistItem[] = [];
  const email = viewer.email?.trim().toLowerCase() ?? null;

  for (const p of projects) {
    if (p.status === "ARCHIVED") continue;
    const isOwner = p.ownerId === viewer.userId;
    const member = p.members.find(
      (m) => (m.userId && m.userId === viewer.userId) || (email && m.email.toLowerCase() === email),
    );
    if (!isOwner && !member) continue;
    if (!isOwner && member?.role === "VIEWER") continue;

    const side = resolveSide(p.ownerId, p.members, { id: viewer.userId, email });
    const labels = findingDisplayIds(p.findings);
    const label = (f: WorklistFinding) => `${labels.get(f.id) ?? "F-???"} ${f.title}`;
    const base = { projectId: p.id, projectName: p.name };
    const findingsHref = `/projects/${p.id}/findings`;
    const reviewHref = `/projects/${p.id}/review`;

    for (const f of p.findings) {
      const mine = ownsFinding(f.owner, email);
      if (mine && isOpenStatus(f.status) && f.dueDate) {
        const diff = f.dueDate.getTime() - nowMs;
        if (diff < 0) {
          const days = Math.floor(-diff / DAY_MS);
          items.push({
            ...base,
            id: `FINDING_OVERDUE:${f.id}`,
            kind: "FINDING_OVERDUE",
            title: label(f),
            detail:
              days >= 1
                ? `Due ${isoDay(f.dueDate)}, ${count(days, "day")} overdue`
                : `Due ${isoDay(f.dueDate)}, now overdue`,
            dueDate: f.dueDate.toISOString(),
            href: findingsHref,
            priority: 1,
          });
        } else if (diff <= DUE_SOON_DAYS * DAY_MS) {
          const days = Math.ceil(diff / DAY_MS);
          items.push({
            ...base,
            id: `FINDING_DUE_SOON:${f.id}`,
            kind: "FINDING_DUE_SOON",
            title: label(f),
            detail: `Due ${isoDay(f.dueDate)}, in ${count(days, "day")}`,
            dueDate: f.dueDate.toISOString(),
            href: findingsHref,
            priority: 2,
          });
        }
      }

      const a = f.acceptance;
      if (a && a.status === "PENDING") {
        const open = a.requireBothSides
          ? side === "CLIENT"
            ? !a.clientApprovedAt
            : !a.assessorApprovedAt
          : !a.assessorApprovedAt &&
            !a.clientApprovedAt &&
            !(a.requestedById && a.requestedById === viewer.userId);
        if (open) {
          items.push({
            ...base,
            id: `ACCEPTANCE_AWAITING_ME:${f.id}`,
            kind: "ACCEPTANCE_AWAITING_ME",
            title: label(f),
            detail: a.requireBothSides
              ? `Risk acceptance needs your ${side === "CLIENT" ? "client" : "assessor"} sign-off`
              : "Risk acceptance needs your approval",
            dueDate: f.dueDate ? f.dueDate.toISOString() : null,
            href: findingsHref,
            priority: 1,
          });
        }
      }

      if (
        f.status === "ACCEPTED" &&
        f.reviewDueAt &&
        f.reviewDueAt.getTime() <= nowMs + EXPIRING_DAYS * DAY_MS &&
        (isOwner || mine)
      ) {
        const diff = f.reviewDueAt.getTime() - nowMs;
        items.push({
          ...base,
          id: `ACCEPTANCE_EXPIRING:${f.id}`,
          kind: "ACCEPTANCE_EXPIRING",
          title: label(f),
          detail:
            diff < 0
              ? `Acceptance review was due ${isoDay(f.reviewDueAt)}`
              : `Acceptance review due ${isoDay(f.reviewDueAt)}, in ${count(Math.ceil(diff / DAY_MS), "day")}`,
          dueDate: f.reviewDueAt.toISOString(),
          href: findingsHref,
          priority: 2,
        });
      }
    }

    const unowned = p.findings.filter(
      (f) => isOpenStatus(f.status) && f.owner.trim() === "",
    ).length;
    if (unowned > 0) {
      items.push({
        ...base,
        id: `FINDING_UNOWNED:${p.id}`,
        kind: "FINDING_UNOWNED",
        title: `${count(unowned, "open finding")} with no owner`,
        detail: "Assign an owner so each finding can be followed up",
        dueDate: null,
        href: findingsHref,
        priority: 3,
      });
    }

    const latest = [...p.snapshots].sort((x, y) => y.version - x.version)[0];
    if (latest) {
      const req = (latest.requirement as SnapshotRequirement) ?? "NONE";
      const status = snapshotStatus(req, latest.signoffs);
      if (status === "PENDING") {
        const can = canSignOff(
          req,
          latest.signoffs,
          { userId: viewer.userId, side },
          latest.createdById,
        );
        if (can.ok) {
          items.push({
            ...base,
            id: `SNAPSHOT_AWAITING_ME:${latest.id}`,
            kind: "SNAPSHOT_AWAITING_ME",
            title: `Snapshot v${latest.version} awaits your sign-off`,
            detail: "Review the frozen assessment and approve it or return it with comments",
            dueDate: null,
            href: reviewHref,
            priority: 1,
          });
        }
      } else if (
        status === "RETURNED" &&
        latest.createdById &&
        latest.createdById === viewer.userId
      ) {
        items.push({
          ...base,
          id: `SNAPSHOT_RETURNED:${latest.id}`,
          kind: "SNAPSHOT_RETURNED",
          title: `Snapshot v${latest.version} was returned for changes`,
          detail: "Address the reviewer's comments, then issue a new snapshot",
          dueDate: null,
          href: reviewHref,
          priority: 1,
        });
      }
    }
  }

  return items.sort(
    (a, b) =>
      a.priority - b.priority ||
      (a.dueDate === null ? 1 : 0) - (b.dueDate === null ? 1 : 0) ||
      (a.dueDate ?? "").localeCompare(b.dueDate ?? "") ||
      a.title.localeCompare(b.title),
  );
}
