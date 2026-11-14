import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Workspace } from "@/components/app/workspace";
import { buttonVariants } from "@/components/ui/button";
import { resolveSide } from "@/lib/acceptance";
import { auth } from "@/lib/auth";
import { AuthzError } from "@/lib/authz";
import { getProjectDetail } from "@/lib/data";
import { mapFindingRows } from "@/lib/finding-view";
import { workspaceSteps } from "@/lib/metrics";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = await paramsPromise;
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
  const findingRows = mapFindingRows(project.findings);
  const vectorOptions = vectors.map((v) => ({ id: v.id, title: v.title }));
  const steps = workspaceSteps(boundaries.length, vectors.length, project.findings);
  const viewerSide = resolveSide(project.ownerId, project.members, {
    id: session.user.id,
    email: session.user.email,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        back={{ href: `/projects/${project.id}`, label: project.name }}
        title="Threat model"
        description="Work through the four steps to build a complete threat model."
      />

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
