import { IssueSnapshotDialog } from "@/components/app/review/issue-snapshot-dialog";
import { SnapshotCard } from "@/components/app/review/snapshot-card";
import { snapshotRequirement } from "@/lib/signoff";
import type { PartySide } from "@/lib/taxonomy";
import type { Readiness, SnapshotSummary } from "@/lib/workflow-types";

export function SnapshotsSection({
  projectId,
  policy,
  readiness,
  snapshots,
  canWrite,
  viewerId,
  viewerSide,
}: {
  projectId: string;
  policy: string;
  readiness: Readiness;
  snapshots: SnapshotSummary[];
  canWrite: boolean;
  viewerId: string;
  viewerSide: PartySide;
}) {
  const sorted = [...snapshots].sort((a, b) => b.version - a.version);
  const latest = sorted[0] ?? null;
  const blockers = readiness.stages
    .filter((s) => s.key !== "SIGN_OFF")
    .flatMap((s) => s.checks)
    .filter((c) => c.level === "BLOCKER" && !c.passed);

  return (
    <section aria-labelledby="snapshots-heading" className="space-y-3">
      <h2 id="snapshots-heading" className="text-lg font-semibold">
        Snapshots
      </h2>
      {canWrite ? (
        <IssueSnapshotDialog
          projectId={projectId}
          requirement={snapshotRequirement(policy)}
          blockers={blockers}
          changedSinceSnapshot={readiness.changedSinceSnapshot}
          latestVersion={latest?.version ?? null}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          You have view-only access, so you cannot issue snapshots or record sign-offs.
        </p>
      )}
      {sorted.length === 0 ? (
        <p className="rounded-md border px-3 py-3 text-sm text-muted-foreground">
          No snapshots yet. When the readiness checks above look right, issue the first snapshot.
          It freezes the assessment so it can be reviewed and handed to an auditor.
        </p>
      ) : (
        <ul className="space-y-4" aria-label="Snapshots, newest first">
          {sorted.map((s) => (
            <SnapshotCard
              key={s.id}
              projectId={projectId}
              snapshot={s}
              canWrite={canWrite}
              viewerId={viewerId}
              viewerSide={viewerSide}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
