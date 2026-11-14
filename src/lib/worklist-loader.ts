import { prisma } from "@/lib/prisma";
import type { WorklistItem } from "@/lib/workflow-types";
import { buildWorklist, type WorklistProject } from "@/lib/worklist";

/** Items needing the viewer's attention across every project they can access. */
export async function listWorklist(
  userId: string,
  email: string | null,
  now = new Date(),
): Promise<WorklistItem[]> {
  // SQLite has no case-insensitive equality, so pending invites (no userId yet) are
  // matched on email in memory.
  const lower = email?.trim().toLowerCase() ?? null;
  const invites = lower
    ? await prisma.projectMember.findMany({
        where: { userId: null },
        select: { projectId: true, email: true },
      })
    : [];
  const invitedProjectIds = invites
    .filter((m) => m.email.toLowerCase() === lower)
    .map((m) => m.projectId);

  const rows = await prisma.project.findMany({
    where: {
      status: { not: "ARCHIVED" },
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
        { id: { in: invitedProjectIds } },
      ],
    },
    select: {
      id: true,
      name: true,
      ownerId: true,
      status: true,
      members: { select: { userId: true, email: true, role: true, side: true } },
      findings: {
        select: {
          id: true,
          title: true,
          severity: true,
          status: true,
          owner: true,
          dueDate: true,
          reviewDueAt: true,
          createdAt: true,
          acceptanceRequests: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              status: true,
              requireBothSides: true,
              requestedById: true,
              assessorApprovedAt: true,
              clientApprovedAt: true,
            },
          },
        },
      },
      snapshots: {
        orderBy: { version: "desc" },
        take: 1,
        select: {
          id: true,
          version: true,
          requirement: true,
          createdById: true,
          signoffs: { select: { side: true, decision: true, userId: true } },
        },
      },
    },
  });

  const projects: WorklistProject[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    ownerId: p.ownerId,
    status: p.status,
    members: p.members,
    snapshots: p.snapshots,
    findings: p.findings.map((f) => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      status: f.status,
      owner: f.owner,
      dueDate: f.dueDate,
      reviewDueAt: f.reviewDueAt,
      createdAt: f.createdAt,
      acceptance: f.acceptanceRequests[0] ?? null,
    })),
  }));
  return buildWorklist(projects, { userId, email }, now);
}
