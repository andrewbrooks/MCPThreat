import { AlertTriangle, GitBranch, Network } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReanalyzeButton } from "@/components/app/reanalyze-button";
import { EmptyState } from "@/components/shared/empty-state";
import { Markdown } from "@/components/shared/markdown";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { AuthzError, requireProjectAccess } from "@/lib/authz";
import { getProjectDetail } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ArchitecturePage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  let project;
  let isOwner = false;
  try {
    project = await getProjectDetail(session.user.id, params.id);
    isOwner = (await requireProjectAccess(session.user.id, params.id)).isOwner;
  } catch (err) {
    if (err instanceof AuthzError) notFound();
    throw err;
  }
  if (!project) notFound();

  const techTags = project.techStack
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const isGithub = project.sourceType === "GITHUB";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Architecture</h1>
          <p className="text-sm text-muted-foreground">
            How this application is put together, for threat-modeling context.
          </p>
        </div>
        {isGithub && isOwner ? <ReanalyzeButton projectId={project.id} /> : null}
      </div>

      {isGithub && project.repoUrl ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link
            href={project.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <GitBranch className="size-4" /> {project.repoUrl.replace(/^https:\/\/github\.com\//, "")}
          </Link>
          {project.analyzedAt ? (
            <span className="text-xs text-muted-foreground">
              Analyzed {new Date(project.analyzedAt).toLocaleString()}
            </span>
          ) : null}
        </div>
      ) : null}

      {project.analysisStatus === "FAILED" ? (
        <div className="flex items-start gap-2 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-400">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Analysis failed</p>
            <p className="text-xs">{project.analysisError ?? "The analysis run did not complete."}</p>
          </div>
        </div>
      ) : null}

      {techTags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {techTags.map((t) => (
            <Badge key={t} className="border-border bg-muted/50 text-muted-foreground">
              {t}
            </Badge>
          ))}
        </div>
      ) : null}

      {project.architecture.trim() ? (
        <Card>
          <CardContent className="pt-4">
            <Markdown source={project.architecture} />
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={Network}
          title="No architecture notes yet"
          description={
            isGithub
              ? "Analysis produced no architecture summary. Try re-running it, or add notes from the project overview."
              : "Add architecture notes from the project overview, or import a GitHub repository to generate them automatically."
          }
        />
      )}
    </div>
  );
}
