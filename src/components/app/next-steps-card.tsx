import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { CheckLevel, ReadinessCheck } from "@/lib/workflow-types";

const LEVEL_TEXT: Record<CheckLevel, string> = {
  BLOCKER: "Blocks issuing",
  WARNING: "Review",
  INFO: "For information",
};
const LEVEL_CLASS: Record<CheckLevel, string> = {
  BLOCKER:
    "border-red-300 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
  WARNING:
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  INFO: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-300",
};

export function NextStepsCard({
  projectId,
  actions,
}: {
  projectId: string;
  actions: ReadinessCheck[];
}) {
  const base = `/projects/${projectId}`;
  const shown = actions.slice(0, 5);
  return (
    <section aria-labelledby="next-steps-heading" className="no-print">
      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="next-steps-heading" className="text-lg font-semibold">
              Next steps
            </h2>
            <Link
              href={`${base}/review`}
              className="text-sm font-medium underline underline-offset-2"
            >
              See all checks
            </Link>
          </div>
          {shown.length === 0 ? (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <CheckCircle2
                className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-hidden
              />
              Nothing is outstanding right now. You can review the checks or issue a snapshot.
            </p>
          ) : (
            <ul className="divide-y">
              {shown.map((a) => (
                <li key={a.id} className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded border px-1.5 py-0.5 text-xs font-medium ${LEVEL_CLASS[a.level]}`}
                    >
                      {LEVEL_TEXT[a.level]}
                    </span>
                    <Link
                      href={`${base}${a.href}`}
                      className="break-words text-sm font-medium underline underline-offset-2"
                    >
                      {a.title}
                    </Link>
                  </div>
                  <p className="break-words text-sm text-muted-foreground">{a.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
