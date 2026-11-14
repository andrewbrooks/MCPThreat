import type { Assessment } from "@/lib/assessment";
import { evaluateReadiness } from "@/lib/readiness";
import { loadAssessment } from "@/lib/report-loader";
import { assessmentModelHash } from "@/lib/snapshot";
import { prisma } from "@/lib/prisma";
import { listSnapshotSummaries } from "@/lib/snapshot-loader";
import type { Readiness, SnapshotSummary } from "@/lib/workflow-types";

export interface ProjectWorkflow {
  assessment: Assessment;
  readiness: Readiness;
  snapshots: SnapshotSummary[];
}

/**
 * Everything the workflow UI needs for one project: the live assessment, its snapshots,
 * and the readiness evaluation. Callers must already have passed requireProjectAccess.
 */
export async function loadProjectWorkflow(
  projectId: string,
  now = new Date(),
): Promise<ProjectWorkflow | null> {
  const [assessment, snapshots, latestStored] = await Promise.all([
    loadAssessment(projectId),
    listSnapshotSummaries(projectId),
    prisma.assessmentSnapshot.findFirst({
      where: { projectId },
      orderBy: { version: "desc" },
      select: { assessment: true },
    }),
  ]);
  if (!assessment) return null;
  let latestSnapshotModelHash: string | null = null;
  if (latestStored) {
    try {
      latestSnapshotModelHash = assessmentModelHash(JSON.parse(latestStored.assessment));
    } catch {
      latestSnapshotModelHash = null; // unreadable: fall back to the full content hash
    }
  }
  const readiness = evaluateReadiness({
    assessment,
    snapshots,
    liveHash: assessmentModelHash(assessment),
    latestSnapshotModelHash,
    now,
  });
  return { assessment, readiness, snapshots };
}
