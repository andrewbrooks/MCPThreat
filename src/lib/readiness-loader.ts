import type { Assessment } from "@/lib/assessment";
import { evaluateReadiness } from "@/lib/readiness";
import { loadAssessment } from "@/lib/report-loader";
import { assessmentContentHash } from "@/lib/snapshot";
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
  const [assessment, snapshots] = await Promise.all([
    loadAssessment(projectId),
    listSnapshotSummaries(projectId),
  ]);
  if (!assessment) return null;
  const readiness = evaluateReadiness({
    assessment,
    snapshots,
    liveHash: assessmentContentHash(assessment),
    now,
  });
  return { assessment, readiness, snapshots };
}
