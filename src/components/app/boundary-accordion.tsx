"use client";

import { ChevronRight, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { AiBadge, ConfidenceBadge, McpCategoryBadge, RiskBadge, StrideBadge } from "@/components/shared/badges";
import { Badge } from "@/components/ui/badge";
import { TRUST_BOUNDARY_LABELS, type TrustBoundaryType } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

interface VectorData {
  id: string;
  title: string;
  description: string;
  strideCategory: string;
  mcpCategory: string;
  likelihood: string;
  impact: string;
  source?: string;
  confidence?: string | null;
  findings: { status: string }[];
}
interface BoundaryData {
  id: string;
  label: string;
  type: string;
  description: string;
  source?: string;
  vectors: VectorData[];
}

const RESOLVED = new Set(["MITIGATED", "CLOSED"]);

function VectorRow({ v }: { v: VectorData }) {
  const resolved = v.findings.filter((f) => RESOLVED.has(f.status)).length;
  return (
    <div className="rounded-md border bg-background/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{v.title}</span>
        <StrideBadge category={v.strideCategory} />
        <McpCategoryBadge category={v.mcpCategory} />
        {v.source === "AI" ? <AiBadge /> : null}
        {v.source === "AI" && v.confidence ? <ConfidenceBadge confidence={v.confidence} /> : null}
      </div>
      {v.description ? (
        <p className="mt-1.5 text-sm text-muted-foreground">{v.description}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <RiskBadge level={v.likelihood} prefix="Likelihood" />
        <RiskBadge level={v.impact} prefix="Impact" />
        <span className="text-muted-foreground">
          {v.findings.length} finding{v.findings.length === 1 ? "" : "s"}
          {v.findings.length > 0 ? ` · ${resolved} resolved` : ""}
        </span>
      </div>
    </div>
  );
}

function BoundaryItem({ b }: { b: BoundaryData }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <ChevronRight
          className={cn("size-4 shrink-0 transition-transform", open && "rotate-90")}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{b.label}</span>
            <Badge className="border-border bg-muted text-muted-foreground">
              {TRUST_BOUNDARY_LABELS[b.type as TrustBoundaryType] ?? b.type}
            </Badge>
            {b.source === "AI" ? <AiBadge /> : null}
          </div>
          {b.description ? (
            <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{b.description}</p>
          ) : null}
        </div>
        <span className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
          <ShieldAlert className="size-4" /> {b.vectors.length}
        </span>
      </button>
      {open ? (
        <div className="space-y-2 border-t p-4">
          {b.vectors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No threat vectors mapped yet.</p>
          ) : (
            b.vectors.map((v) => <VectorRow key={v.id} v={v} />)
          )}
        </div>
      ) : null}
    </div>
  );
}

export function BoundaryAccordion({ boundaries }: { boundaries: BoundaryData[] }) {
  return (
    <div className="space-y-3">
      {boundaries.map((b) => (
        <BoundaryItem key={b.id} b={b} />
      ))}
    </div>
  );
}
