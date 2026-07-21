import { BookOpen, ExternalLink, ShieldCheck } from "lucide-react";
import { StrideBadge } from "@/components/shared/badges";
import { frameworksForCategory } from "@/lib/frameworks";
import { getKnowledge } from "@/lib/mcp-knowledge-base";
import type { McpCategory } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

export function KnowledgePanel({
  category,
  className,
}: {
  category: McpCategory;
  className?: string;
}) {
  const kb = getKnowledge(category);
  if (!kb) return null;

  return (
    <div className={cn("rounded-lg border bg-muted/30 p-4", className)}>
      <div className="flex items-center gap-2">
        <BookOpen className="size-4 text-primary" />
        <h4 className="font-medium">{kb.title}</h4>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{kb.summary}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {kb.strideAlignment.map((s) => (
          <StrideBadge key={s} category={s} />
        ))}
      </div>

      <div className="mt-3">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <ShieldCheck className="size-4 text-emerald-400" /> Recommended mitigations
        </div>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-muted-foreground/60">
          {kb.mitigations.map((m) => (
            <li key={m} className="pl-1">
              {m}
            </li>
          ))}
        </ul>
      </div>

      <FrameworkTags category={category} />

      {kb.references.length > 0 ? (
        <div className="mt-3 border-t pt-3">
          <div className="text-xs font-medium text-muted-foreground">References</div>
          <ul className="mt-1 space-y-1">
            {kb.references.map((r) => (
              <li key={r.url}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {r.label} <ExternalLink className="size-3" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function FrameworkTags({ category }: { category: McpCategory }) {
  const fw = frameworksForCategory(category);
  if (fw.owasp.length === 0 && fw.atlas.length === 0) return null;
  return (
    <div className="mt-3 border-t pt-3">
      <div className="text-xs font-medium text-muted-foreground">Framework mapping</div>
      <div className="mt-1.5 space-y-1.5">
        {fw.owasp.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">OWASP LLM</span>
            {fw.owasp.map((i) => (
              <a
                key={i.id}
                href={i.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-sm border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[11px] text-indigo-700 hover:bg-indigo-100 hover:underline dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25"
              >
                {i.id} · {i.name}
              </a>
            ))}
          </div>
        ) : null}
        {fw.atlas.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">MITRE ATLAS</span>
            {fw.atlas.map((i) => (
              <a
                key={i.id}
                href={i.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-sm border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[11px] text-rose-700 hover:bg-rose-100 hover:underline dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/25"
              >
                {i.id} · {i.name}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
