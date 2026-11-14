import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReadinessSection } from "@/components/app/review/readiness-section";
import { SnapshotsSection } from "@/components/app/review/snapshots-section";
import { auth } from "@/lib/auth";
import { AuthzError, requireProjectAccess } from "@/lib/authz";
import { loadProjectWorkflow } from "@/lib/readiness-loader";
import { snapshotRequirement } from "@/lib/signoff";
import {
  ACCEPTANCE_POLICY_DESCRIPTIONS,
  ACCEPTANCE_POLICY_LABELS,
  type AcceptancePolicy,
} from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

const SIGNOFF_MEANING = {
  NONE: "Snapshots are recorded as issued and need no review.",
  SINGLE: "A snapshot needs approval from one reviewer other than the person who issued it.",
  DUAL: "A snapshot needs one assessor and one client to approve it.",
} as const;

export default async function ReviewPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  let access;
  try {
    access = await requireProjectAccess(session.user.id, params.id);
  } catch (err) {
    if (err instanceof AuthzError) notFound();
    throw err;
  }

  const workflow = await loadProjectWorkflow(params.id);
  if (!workflow) notFound();

  const canWrite = access.role !== "VIEWER";
  const rawPolicy = access.project?.acceptancePolicy ?? "OFF";
  const policy: AcceptancePolicy = rawPolicy === "SINGLE" || rawPolicy === "DUAL" ? rawPolicy : "OFF";
  const requirement = snapshotRequirement(policy);
  const policyLabel = (ACCEPTANCE_POLICY_LABELS[policy] ?? policy).replace(" — ", ", ");

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <Link
          href={`/projects/${params.id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          <span aria-hidden="true">← </span>
          Back to {workflow.assessment.record.projectName}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Review and sign-off</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Issue a frozen snapshot of the assessment, have it reviewed, and hand that record to an
          auditor.
        </p>
        <p className="mt-2 text-sm">
          <span className="font-medium">Acceptance policy: {policyLabel}.</span>{" "}
          <span className="text-muted-foreground">
            {SIGNOFF_MEANING[requirement]} {ACCEPTANCE_POLICY_DESCRIPTIONS[policy]}
          </span>
        </p>
      </header>

      <ReadinessSection readiness={workflow.readiness} projectId={params.id} />

      <SnapshotsSection
        projectId={params.id}
        policy={policy}
        readiness={workflow.readiness}
        snapshots={workflow.snapshots}
        canWrite={canWrite}
        viewerId={session.user.id}
        viewerSide={access.side}
      />

      <details className="rounded-lg border bg-card p-4 text-sm">
        <summary className="cursor-pointer font-medium">What a snapshot is</summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
          <li>It freezes the assessment as it is now.</li>
          <li>It cannot be edited. Later changes to the model need a new snapshot.</li>
          <li>
            The SHA-256 hash identifies the assessed content, so a later copy can be checked
            against it.
          </li>
          <li>It is not a digital signature or a certification.</li>
        </ul>
      </details>
    </div>
  );
}
