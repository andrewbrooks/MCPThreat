import { Boxes, FileText, Network, ShieldAlert, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BoundaryAccordion } from "@/components/app/boundary-accordion";
import { FindingsTable } from "@/components/app/findings-table";
import { ProjectDetailsEditor } from "@/components/app/project-details-editor";
import { EmptyState } from "@/components/shared/empty-state";
import { RiskMatrix } from "@/components/risk-matrix";
import { TrustBoundaryMap } from "@/components/trust-boundary-map";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { auth } from "@/lib/auth";
import { AuthzError } from "@/lib/authz";
import { getProjectDetail } from "@/lib/data";
import { mapFindingRow } from "@/lib/finding-view";
import { completionPct, openFindingCount } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: { id: string } }) {
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
  const pct = completionPct(vectors, project.findings);
  const openCount = openFindingCount(project.findings);

  const aiBoundaries = boundaries.filter((b) => b.source === "AI").length;
  const aiVectors = vectors.filter((v) => v.source === "AI").length;
  const aiFindings = project.findings.filter((f) => f.source === "AI").length;
  const aiTotal = aiBoundaries + aiVectors + aiFindings;
  const isGithub = project.sourceType === "GITHUB";
  const repoShort = project.repoUrl?.replace(/^https:\/\/github\.com\//, "") ?? "";

  const findingRows = project.findings.map(mapFindingRow);
  const vectorOptions = vectors.map((v) => ({ id: v.id, title: v.title }));
  const riskVectors = vectors.map((v) => ({
    likelihood: v.likelihood,
    impact: v.impact,
    resolved: v.findings.some((f) => f.status === "MITIGATED" || f.status === "CLOSED"),
  }));
  const mapFindings = project.findings.map((f) => ({
    id: f.id,
    title: f.title,
    severity: f.severity,
    status: f.status,
    description: f.description,
    recommendation: f.recommendation,
    threatVector: f.threatVector
      ? {
          mcpCategory: f.threatVector.mcpCategory,
          strideCategory: f.threatVector.strideCategory,
          trustBoundary: f.threatVector.trustBoundary
            ? { type: f.threatVector.trustBoundary.type }
            : null,
        }
      : null,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {isGithub && project.analysisStatus === "READY" && aiTotal > 0 ? (
        <div className="flex flex-wrap items-start gap-2 rounded-md border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200">
          <Sparkles className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Generated from {repoShort || "a GitHub repository"}</p>
            <p className="text-xs text-violet-700/90 dark:text-violet-300/90">
              {aiTotal} AI-suggested item{aiTotal === 1 ? "" : "s"} to review
              {" — "}
              {aiBoundaries} boundar{aiBoundaries === 1 ? "y" : "ies"}, {aiVectors} vector
              {aiVectors === 1 ? "" : "s"}, {aiFindings} finding{aiFindings === 1 ? "" : "s"}.
              Verify each before relying on it.
            </p>
          </div>
          <Link
            href={`/projects/${project.id}/architecture`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Network className="size-4" /> Architecture
          </Link>
        </div>
      ) : null}
      {isGithub && project.analysisStatus === "FAILED" ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          <p className="font-medium">Automated analysis failed</p>
          <p className="text-xs">{project.analysisError ?? "The analysis did not complete."} Open Architecture to retry.</p>
        </div>
      ) : null}
      <div className="flex flex-col gap-4">
        <ProjectDetailsEditor
          projectId={project.id}
          initial={{
            name: project.name,
            description: project.description,
            mcpServerUrl: project.mcpServerUrl ?? "",
            architecture: project.architecture,
            status: project.status,
            acceptancePolicy: project.acceptancePolicy,
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/projects/${project.id}/model`}
            className={buttonVariants({ variant: "outline" })}
          >
            <Boxes className="size-4" /> Open Workspace
          </Link>
          <Link
            href={`/projects/${project.id}/report`}
            className={buttonVariants({ variant: "outline" })}
          >
            <FileText className="size-4" /> Generate Report
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Mitigation Completion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-semibold">{pct}%</div>
            <Progress value={pct} />
            <p className="text-xs text-muted-foreground">
              Vectors with a mitigated or closed finding
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Open Findings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{openCount}</div>
            <p className="text-xs text-muted-foreground">of {project.findings.length} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{vectors.length}</div>
            <p className="text-xs text-muted-foreground">
              vectors across {boundaries.length} boundaries
            </p>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Trust Boundaries</h2>
          <Link
            href={`/projects/${project.id}/model`}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Edit in workspace
          </Link>
        </div>
        {boundaries.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title="No trust boundaries yet"
            description="Define trust boundaries in the workspace to start mapping threat vectors."
            action={
              <Link
                href={`/projects/${project.id}/model`}
                className={buttonVariants({ size: "sm" })}
              >
                Open Workspace
              </Link>
            }
          />
        ) : (
          <BoundaryAccordion boundaries={boundaries} />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Risk overview</h2>
        <Card>
          <CardContent className="pt-4">
            <RiskMatrix vectors={riskVectors} />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Trust boundary map</h2>
        <Card>
          <CardContent className="pt-4">
            <TrustBoundaryMap
              projectId={project.id}
              findings={mapFindings}
              threatModel={project.threatModel}
            />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Findings</h2>
        <FindingsTable projectId={project.id} findings={findingRows} vectors={vectorOptions} />
      </section>
    </div>
  );
}
