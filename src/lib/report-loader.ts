import { buildAssessment, type Assessment } from "@/lib/assessment";
import { prisma } from "@/lib/prisma";

/**
 * Load a project's full model and build the Assessment every report format renders
 * from. Callers must have already passed requireProjectAccess for this project.
 * Attachments are listed by metadata only; file contents are never loaded here.
 */
export async function loadAssessment(projectId: string): Promise<Assessment | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: { select: { name: true, email: true } },
      members: { select: { email: true, role: true, side: true } },
      findings: {
        include: {
          attachments: { select: { filename: true, mimeType: true, size: true } },
          acceptanceRequests: true,
        },
      },
      threatModel: {
        include: {
          boundaries: {
            orderBy: { createdAt: "asc" },
            include: { vectors: { orderBy: { createdAt: "asc" } } },
          },
        },
      },
    },
  });
  if (!project) return null;

  const audit = await prisma.auditEvent.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });

  return buildAssessment({
    project,
    owner: project.owner,
    members: project.members,
    boundaries: project.threatModel?.boundaries ?? [],
    findings: project.findings,
    audit,
  });
}
