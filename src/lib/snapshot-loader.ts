import { awaitingSides, snapshotStatus } from "@/lib/signoff";
import { prisma } from "@/lib/prisma";
import type {
  SnapshotRequirement,
  SnapshotSignoffView,
  SnapshotSummary,
} from "@/lib/workflow-types";

type Row = {
  id: string;
  version: number;
  note: string;
  requirement: string;
  contentHash: string;
  createdAt: Date;
  createdByLabel: string;
  createdById: string | null;
  signoffs: {
    side: string;
    decision: string;
    comment: string;
    userId: string | null;
    userLabel: string;
    createdAt: Date;
  }[];
};

export function toSnapshotSummary(row: Row, latestVersion: number): SnapshotSummary {
  const requirement = (row.requirement as SnapshotRequirement) ?? "NONE";
  const ordered = [...row.signoffs].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const signoffs: SnapshotSignoffView[] = ordered.map((s) => ({
    userId: s.userId,
    side: s.side === "CLIENT" ? "CLIENT" : "ASSESSOR",
    decision: s.decision === "RETURNED" ? "RETURNED" : "APPROVED",
    comment: s.comment,
    by: s.userLabel,
    at: s.createdAt.toISOString(),
  }));
  return {
    id: row.id,
    version: row.version,
    note: row.note,
    requirement,
    status: snapshotStatus(requirement, ordered),
    superseded: row.version < latestVersion,
    contentHash: row.contentHash,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdByLabel,
    createdById: row.createdById,
    signoffs,
    awaiting: awaitingSides(requirement, ordered),
  };
}

/** Snapshots for a project, newest first. The frozen assessment text is not loaded. */
export async function listSnapshotSummaries(projectId: string): Promise<SnapshotSummary[]> {
  const rows = await prisma.assessmentSnapshot.findMany({
    where: { projectId },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      note: true,
      requirement: true,
      contentHash: true,
      createdAt: true,
      createdByLabel: true,
      createdById: true,
      signoffs: true,
    },
  });
  const latest = rows[0]?.version ?? 0;
  return rows.map((r) => toSnapshotSummary(r, latest));
}
