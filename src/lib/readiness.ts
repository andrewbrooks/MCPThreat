import type { Assessment } from "@/lib/assessment";
import type { Readiness, SnapshotSummary } from "@/lib/workflow-types";

export interface ReadinessInput {
  assessment: Assessment;
  /** Newest first. */
  snapshots: SnapshotSummary[];
  /** assessmentContentHash of the live assessment. */
  liveHash: string;
  now: Date;
}

/** PLACEHOLDER: replaced by the real implementation. */
export function evaluateReadiness(input: ReadinessInput): Readiness {
  void input;
  return {
    stages: [],
    currentStage: "SCOPE",
    nextActions: [],
    canIssue: true,
    changedSinceSnapshot: null,
    latestSnapshot: null,
  };
}
