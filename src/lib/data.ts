import type { Prisma } from "@prisma/client";
import { recordAudit } from "@/lib/audit";
import { requireProjectAccess } from "@/lib/authz";
import {
  completionPct,
  openFindingCount,
  openSeverityBreakdown,
} from "@/lib/metrics";
import { prisma } from "@/lib/prisma";

// Read-side data access for server components. Mutations go through the API routes;
// both sides enforce the same ownership/membership checks.

/**
 * Reopen accepted findings whose review timer has elapsed and log a REOPENED audit
 * event for each. Runs lazily on read so a revisit-scheduled finding automatically
 * returns to OPEN once due, without needing a background scheduler.
 */
async function reopenFindings(where: Prisma.FindingWhereInput): Promise<number> {
  const due = await prisma.finding.findMany({
    where: { ...where, status: "ACCEPTED", reviewDueAt: { not: null, lte: new Date() } },
    select: { id: true, projectId: true, title: true },
  });
  for (const f of due) {
    await prisma.finding.update({
      where: { id: f.id },
      data: { status: "OPEN", reviewDueAt: null, reviewIntervalDays: null },
    });
    // Expire the approved acceptance that lapsed, if any.
    const expired = await prisma.acceptanceRequest.updateMany({
      where: { findingId: f.id, status: "APPROVED" },
      data: { status: "EXPIRED" },
    });
    if (expired.count > 0) {
      await recordAudit({
        projectId: f.projectId,
        findingId: f.id,
        actorLabel: "system",
        action: "ACCEPTANCE_EXPIRED",
        detail: "risk acceptance expired",
      });
    }
    await recordAudit({
      projectId: f.projectId,
      findingId: f.id,
      actorLabel: "system",
      action: "REOPENED",
      detail: `Review timer elapsed — reopened “${f.title}”`,
    });
  }
  return due.length;
}

export function reopenDueFindings(projectId: string) {
  return reopenFindings({ projectId });
}

/** Projects the user owns or is a member of, with computed dashboard stats. */
export async function listProjectSummaries(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  const email = user?.email?.toLowerCase() ?? "";

  const accessFilter = {
    OR: [
      { ownerId: userId },
      { members: { some: { userId } } },
      { members: { some: { email } } },
    ],
  };

  // Reopen any due findings across the user's projects so dashboard counts are current.
  await reopenFindings({ project: accessFilter });

  const projects = await prisma.project.findMany({
    where: accessFilter,
    orderBy: { updatedAt: "desc" },
    include: {
      findings: { select: { status: true, severity: true, threatVectorId: true } },
      threatModel: {
        include: { boundaries: { include: { vectors: { select: { id: true } } } } },
      },
    },
  });

  return projects.map((p) => {
    const vectors = p.threatModel?.boundaries.flatMap((b) => b.vectors) ?? [];
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      mcpServerUrl: p.mcpServerUrl,
      updatedAt: p.updatedAt,
      vectorCount: vectors.length,
      boundaryCount: p.threatModel?.boundaries.length ?? 0,
      findingCount: p.findings.length,
      openCount: openFindingCount(p.findings),
      completionPct: completionPct(vectors, p.findings),
      openSeverity: openSeverityBreakdown(p.findings),
    };
  });
}

/** Full project detail with the threat model tree and findings. Enforces access. */
export async function getProjectDetail(userId: string, projectId: string) {
  await requireProjectAccess(userId, projectId);
  await reopenDueFindings(projectId);
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: { select: { name: true, email: true } },
      members: true,
      threatModel: {
        include: {
          boundaries: {
            orderBy: { createdAt: "asc" },
            include: {
              vectors: {
                orderBy: { createdAt: "asc" },
                include: {
                  findings: { orderBy: { createdAt: "desc" } },
                },
              },
            },
          },
        },
      },
      findings: {
        orderBy: { createdAt: "desc" },
        include: {
          threatVector: {
            select: {
              id: true,
              title: true,
              mcpCategory: true,
              strideCategory: true,
              trustBoundary: { select: { type: true } },
            },
          },
          attachments: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              filename: true,
              mimeType: true,
              size: true,
              uploadedByLabel: true,
              createdAt: true,
            },
          },
          acceptanceRequests: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });
}

export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProjectDetail>>>;
export type ProjectSummary = Awaited<ReturnType<typeof listProjectSummaries>>[number];

/** Lightweight project list for the sidebar switcher. */
export async function listProjectsForSwitcher(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  const email = user?.email?.toLowerCase() ?? "";
  return prisma.project.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
        { members: { some: { email } } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, status: true },
  });
}
