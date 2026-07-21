import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FindingsTable } from "@/components/app/findings-table";
import { resolveSide } from "@/lib/acceptance";
import { auth } from "@/lib/auth";
import { AuthzError } from "@/lib/authz";
import { getProjectDetail } from "@/lib/data";
import { mapFindingRow } from "@/lib/finding-view";

export const dynamic = "force-dynamic";

export default async function FindingsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { finding?: string };
}) {
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
  const findingRows = project.findings.map(mapFindingRow);
  const viewerSide = resolveSide(project.ownerId, project.members, {
    id: session.user.id,
    email: session.user.email,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link
          href={`/projects/${project.id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {project.name}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Findings</h1>
        <p className="text-sm text-muted-foreground">
          Track, filter, and update findings across the project.
        </p>
      </div>

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
