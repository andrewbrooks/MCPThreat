import { notFound, redirect } from "next/navigation";
import { FindingsTable } from "@/components/app/findings-table";
import { resolveSide } from "@/lib/acceptance";
import { auth } from "@/lib/auth";
import { AuthzError } from "@/lib/authz";
import { getProjectDetail } from "@/lib/data";
import { mapFindingRows } from "@/lib/finding-view";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";

export default async function FindingsPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ finding?: string }>;
}) {
  const params = await paramsPromise;
  const searchParams = await searchParamsPromise;
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

  const vectors = (project.threatModel?.boundaries ?? []).flatMap((b) => b.vectors);
  const vectorOptions = vectors.map((v) => ({ id: v.id, title: v.title }));
  const findingRows = mapFindingRows(project.findings);
  const viewerSide = resolveSide(project.ownerId, project.members, {
    id: session.user.id,
    email: session.user.email,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        back={{ href: `/projects/${project.id}`, label: project.name }}
        title="Findings"
        description="Track, filter, and update findings across the project."
      />

      <FindingsTable
        projectId={project.id}
        findings={findingRows}
        vectors={vectorOptions}
        editable
        acceptancePolicy={project.acceptancePolicy}
        viewerSide={viewerSide}
        viewerId={session.user.id}
        initialOpenId={searchParams.finding ?? null}
      />
    </div>
  );
}
