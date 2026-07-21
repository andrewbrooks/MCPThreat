import { FolderKanban, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ImportRepoDialog } from "@/components/app/import-repo-dialog";
import { NewProjectDialog } from "@/components/app/new-project-dialog";
import { ProjectStatusBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { auth } from "@/lib/auth";
import { listProjectSummaries, type ProjectSummary } from "@/lib/data";

export const dynamic = "force-dynamic";

function SeverityBreakdown({ open }: { open: ProjectSummary["openSeverity"] }) {
  const items: { label: string; count: number; className: string }[] = [
    { label: "Critical", count: open.CRITICAL, className: "text-red-600 dark:text-red-400" },
    { label: "High", count: open.HIGH, className: "text-orange-600 dark:text-orange-400" },
    { label: "Medium", count: open.MEDIUM, className: "text-amber-600 dark:text-amber-400" },
  ];
  return (
    <div className="flex gap-3 text-xs">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-1">
          <span className={`font-semibold ${i.className}`}>{i.count}</span>
          <span className="text-muted-foreground">{i.label}</span>
        </div>
      ))}
    </div>
  );
}

function ProjectCard({ p }: { p: ProjectSummary }) {
  return (
    <Link href={`/projects/${p.id}`} className="group">
      <Card className="h-full transition-colors group-hover:border-primary/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-tight">{p.name}</h3>
            <ProjectStatusBadge status={p.status} />
          </div>
          {p.description ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <ShieldAlert className="size-4" />
              <span className="font-semibold text-foreground">{p.openCount}</span> open
            </span>
            <span className="text-muted-foreground">
              {p.vectorCount} vectors · {p.boundaryCount} boundaries
            </span>
          </div>
          <SeverityBreakdown open={p.openSeverity} />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Mitigation completion</span>
              <span className="font-medium text-foreground">{p.completionPct}%</span>
            </div>
            <Progress value={p.completionPct} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const projects = await listProjectSummaries(session.user.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Threat models across your MCP server projects.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ImportRepoDialog />
          <NewProjectDialog />
        </div>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create your first project to start modeling threats for an MCP server."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ImportRepoDialog />
              <NewProjectDialog />
            </div>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
