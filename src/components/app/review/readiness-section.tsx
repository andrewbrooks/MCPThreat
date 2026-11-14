import { CheckCircle2, Circle, CircleDot, Info, XCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Readiness, StageState, StageStatus } from "@/lib/workflow-types";

const STATUS_TEXT: Record<StageStatus, string> = {
  DONE: "Done",
  CURRENT: "Current",
  UPCOMING: "Upcoming",
};

function StageStatusLabel({ status }: { status: StageStatus }) {
  const Icon = status === "DONE" ? CheckCircle2 : status === "CURRENT" ? CircleDot : Circle;
  const tone =
    status === "DONE"
      ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
      : status === "CURRENT"
        ? "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200"
        : "border-border bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        tone,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {STATUS_TEXT[status]}
    </span>
  );
}

function CheckItem({ check, projectId }: { check: StageState["checks"][number]; projectId: string }) {
  const blocker = !check.passed && check.level === "BLOCKER";
  return (
    <li
      className={cn(
        "flex gap-3 rounded-md border px-3 py-2 text-sm",
        blocker
          ? "border-red-300 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10"
          : "border-border",
      )}
    >
      {check.passed ? (
        <CheckCircle2
          className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-400"
          aria-hidden="true"
        />
      ) : check.level === "INFO" ? (
        <Info
          className="mt-0.5 size-4 shrink-0 text-sky-700 dark:text-sky-400"
          aria-hidden="true"
        />
      ) : (
        <XCircle
          className="mt-0.5 size-4 shrink-0 text-red-700 dark:text-red-400"
          aria-hidden="true"
        />
      )}
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium">
          <span className="sr-only">
            {check.passed ? "Passed: " : check.level === "INFO" ? "For information: " : "Not passed: "}
          </span>
          {check.title}
          {blocker ? (
            <span className="ml-2 inline-block rounded-sm border border-red-400 bg-white px-1.5 py-0.5 text-xs font-semibold text-red-900 dark:border-red-400/60 dark:bg-red-950 dark:text-red-100">
              Blocks issuing
            </span>
          ) : !check.passed && check.level === "WARNING" ? (
            <span className="ml-2 inline-block rounded-sm border border-amber-400 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-950 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-100">
              Review
            </span>
          ) : !check.passed && check.level === "INFO" ? (
            <span className="ml-2 inline-block rounded-sm border border-sky-400 bg-sky-50 px-1.5 py-0.5 text-xs font-medium text-sky-950 dark:border-sky-500/50 dark:bg-sky-500/10 dark:text-sky-100">
              For information
            </span>
          ) : null}
        </p>
        <p className="text-muted-foreground">{check.detail}</p>
        {!check.passed ? (
          <Link
            href={`/projects/${projectId}${check.href}`}
            className="inline-block text-sm text-primary underline underline-offset-2"
          >
            Go to {check.href ? check.href.replace(/^\//, "").replace(/[-/]/g, " ") : "overview"}
            <span className="sr-only"> to fix: {check.title}</span>
          </Link>
        ) : null}
      </div>
    </li>
  );
}

export function ReadinessSection({
  readiness,
  projectId,
}: {
  readiness: Readiness;
  projectId: string;
}) {
  return (
    <section aria-labelledby="readiness-heading" className="space-y-3">
      <h2 id="readiness-heading" className="text-lg font-semibold">
        Readiness
      </h2>
      <p className="text-sm text-muted-foreground">
        These checks look at the live model. Failed checks marked &quot;Blocks issuing&quot; need
        attention before a snapshot can be issued.
      </p>
      {readiness.stages.length === 0 ? (
        <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
          No readiness information is available yet.
        </p>
      ) : (
        <ol className="space-y-4">
          {readiness.stages.map((stage) => (
            <li key={stage.key} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold">{stage.label}</h3>
                <StageStatusLabel status={stage.status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{stage.description}</p>
              {stage.checks.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No checks for this stage.</p>
              ) : (
                <ul className="mt-3 space-y-2" aria-label={`${stage.label} checks`}>
                  {stage.checks.map((c) => (
                    <CheckItem key={c.id} check={c} projectId={projectId} />
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
