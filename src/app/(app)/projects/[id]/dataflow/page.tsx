import { Workflow } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { DataflowDiagram } from "@/components/dataflow-diagram";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { AuthzError } from "@/lib/authz";
import { getProjectDetail } from "@/lib/data";
import { parseDataflow } from "@/lib/dataflow";

export const dynamic = "force-dynamic";

export default async function DataflowPage({ params }: { params: { id: string } }) {
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
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dataflow</h1>
        <p className="text-sm text-muted-foreground">
          How data moves through the application, with trust-boundary crossings highlighted.
        </p>
      </div>

      {dataflow && dataflow.nodes.length > 0 ? (
        <>
          <Card>
            <CardContent className="pt-4">
              <DataflowDiagram dataflow={dataflow} />
            </CardContent>
          </Card>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Flows</h2>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-medium">From</th>
                    <th className="px-3 py-2 font-medium">To</th>
                    <th className="px-3 py-2 font-medium">Data</th>
                    <th className="px-3 py-2 font-medium">Data class</th>
                    <th className="px-3 py-2 font-medium">Crosses boundary</th>
                  </tr>
                </thead>
                <tbody>
                  {dataflow.edges.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-3 text-muted-foreground">
                        No flows recorded.
                      </td>
                    </tr>
                  ) : (
                    dataflow.edges.map((e) => (
                      <tr key={e.id} className="border-b last:border-0 even:bg-muted/20">
                        <td className="px-3 py-2">{nodeLabel.get(e.from) ?? e.from}</td>
                        <td className="px-3 py-2">{nodeLabel.get(e.to) ?? e.to}</td>
                        <td className="px-3 py-2">{e.label || "—"}</td>
                        <td className="px-3 py-2">{e.dataClass || "—"}</td>
                        <td className="px-3 py-2">
                          {e.crossesBoundary ? (
                            <span className="font-medium text-red-600 dark:text-red-400">Yes</span>
                          ) : (
                            <span className="text-muted-foreground">No</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
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
