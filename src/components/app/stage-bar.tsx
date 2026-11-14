import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import type { Readiness, StageKey } from "@/lib/workflow-types";
import { cn } from "@/lib/utils";

const STAGE_PATH: Record<StageKey, string> = {
  SCOPE: "",
  MODEL: "/model",
  ASSESS: "/findings",
  REMEDIATE: "/findings",
  SIGN_OFF: "/review",
};

const STATUS_TEXT = { DONE: "Done", CURRENT: "Current", UPCOMING: "Upcoming" } as const;

export function StageBar({ projectId, readiness }: { projectId: string; readiness: Readiness }) {
  if (readiness.stages.length === 0) return null;
  const base = `/projects/${projectId}`;
  const next = readiness.nextActions[0];
  const complete = readiness.currentStage === "COMPLETE";

  return (
    <nav aria-label="Project progress" className="no-print mx-auto mb-6 max-w-6xl space-y-2">
      <ol className="relative flex gap-2 overflow-x-auto pb-1">
        {readiness.stages.map((s, i) => {
          const current = s.status === "CURRENT";
          return (
            <li key={s.key} className="min-w-[8.5rem] flex-1">
              <Link
                href={`${base}${STAGE_PATH[s.key]}`}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex h-full items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent/50",
                  current
                    ? "border-primary bg-primary/10 font-medium"
                    : s.status === "DONE"
                      ? "bg-card"
                      : "bg-card text-muted-foreground",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs",
                    s.status === "DONE" &&
                      "border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-500/10 dark:text-emerald-300",
                    current && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {s.status === "DONE" ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block">
                    <span className="sr-only">Step {i + 1}: </span>
                    {s.label}
                  </span>
                  <span
                    className={cn(
                      "block text-xs font-normal",
                      current ? "text-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    {STATUS_TEXT[s.status]}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      <p className="break-words text-sm text-muted-foreground">
        {complete ? (
          "The latest snapshot is decided and nothing has changed since."
        ) : next ? (
          <>
            Next:{" "}
            <Link
              href={`${base}${next.href}`}
              className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-2"
            >
              {next.title}
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </>
        ) : null}
      </p>
      {readiness.changedSinceSnapshot ? (
        <p
          role="status"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
        >
          The model has changed since the latest snapshot. Issue a new snapshot to record the
          changes.
        </p>
      ) : null}
    </nav>
  );
}
