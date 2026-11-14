import { Workflow } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { DataflowView } from "@/components/dataflow-view";
import { EmptyState } from "@/components/shared/empty-state";
import { auth } from "@/lib/auth";
import { AuthzError } from "@/lib/authz";
import { getProjectDetail } from "@/lib/data";
import { parseDataflow } from "@/lib/dataflow";

export const dynamic = "force-dynamic";

export default async function DataflowPage({
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

  const dataflow = parseDataflow(project.threatModel?.dataflow);
  const nodeLabel = new Map((dataflow?.nodes ?? []).map((n) => [n.id, n.label]));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dataflow</h1>
        <p className="text-sm text-muted-foreground">
          How data moves through the application, with trust-boundary crossings highlighted.
        </p>
      </div>

      {dataflow && dataflow.nodes.length > 0 ? (
        <DataflowView
          dataflow={dataflow}
          filename={`${project.name}-dataflow`}
          flows={dataflow.edges.map((e) => ({
            id: e.id,
            from: nodeLabel.get(e.from) ?? e.from,
            to: nodeLabel.get(e.to) ?? e.to,
            data: e.label || "",
            dataClass: e.dataClass || "",
            crosses: e.crossesBoundary,
          }))}
        />
      ) : (
        <EmptyState
          icon={Workflow}
          title="No dataflow yet"
          description="Import a GitHub repository to generate a data-flow diagram automatically, or model one as the threat model grows."
        />
      )}
    </div>
  );
}
