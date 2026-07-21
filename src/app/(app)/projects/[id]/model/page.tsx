import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Workspace } from "@/components/app/workspace";
import { buttonVariants } from "@/components/ui/button";
import { resolveSide } from "@/lib/acceptance";
import { auth } from "@/lib/auth";
import { AuthzError } from "@/lib/authz";
import { getProjectDetail } from "@/lib/data";
import { mapFindingRow } from "@/lib/finding-view";
import { workspaceSteps } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  let project;
  try {
    project = await getProjectDetail(session.user.id, params.id);
  } catch (err) {
    if (err instanceof AuthzError) notFound();
    throw err;
  }
  if (!project) notFound();

  const boundaries = project.threatModel?.boundaries ?? [];
  const vectors = boundaries.flatMap((b) => b.vectors);

  const boundaryItems = boundaries.map((b) => ({
    id: b.id,
    label: b.label,
    type: b.type,
    description: b.description,
    vectorCount: b.vectors.length,
  }));
  const vectorItems = vectors.map((v) => ({
    id: v.id,
    trustBoundaryId: v.trustBoundaryId,
    title: v.title,
    description: v.description,
    strideCategory: v.strideCategory,
    mcpCategory: v.mcpCategory,
    likelihood: v.likelihood,
    impact: v.impact,
  }));
  const findingRows = project.findings.map(mapFindingRow);
  const vectorOptions = vectors.map((v) => ({ id: v.id, title: v.title }));
  const steps = workspaceSteps(boundaries.length, vectors.length, project.findings);
  const viewerSide = resolveSide(project.ownerId, project.members, {
    id: session.user.id,
    email: session.user.email,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href={`/projects/${project.id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {project.name}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Threat Model Workspace</h1>
        <p className="text-sm text-muted-foreground">
          Work through the four steps to build a complete threat model.
        </p>
      </div>

      <Workspace
        projectId={project.id}
        boundaries={boundaryItems}
        vectors={vectorItems}
        findings={findingRows}
        vectorOptions={vectorOptions}
        stepsComplete={steps}
        acceptancePolicy={project.acceptancePolicy}
        viewerSide={viewerSide}
        viewerId={session.user.id}
      />

      <div>
        <Link
          href={`/projects/${project.id}/report`}
          className={buttonVariants({ variant: "outline" })}
        >
          View report
        </Link>
      </div>
    </div>
  );
}
