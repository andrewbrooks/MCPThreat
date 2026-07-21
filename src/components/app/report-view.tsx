"use client";

import { ChevronDown, ChevronsUpDown, ChevronUp, Copy, ExternalLink, Printer } from "lucide-react";
import { useState } from "react";
import {
  McpCategoryBadge,
  ProjectStatusBadge,
  RiskBadge,
  SeverityBadge,
  StatusPill,
  StrideBadge,
} from "@/components/shared/badges";
import { Markdown } from "@/components/shared/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { getKnowledge } from "@/lib/mcp-knowledge-base";
import type { ReportData } from "@/lib/report";
import { RISK_BAND_CLASSES, RISK_BAND_LABELS, type RiskBand } from "@/lib/risk";
import {
  FINDING_STATUSES,
  SEVERITY_RANK,
  TRUST_BOUNDARY_LABELS,
  type FindingStatus,
  type McpCategory,
  type Severity,
  type TrustBoundaryType,
} from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

type Dir = "asc" | "desc";
type FindingKey = "severity" | "status" | "owner" | "dueDate";
type SummaryKey = "status" | "count";
type Tab = "overview" | "vectors" | "findings" | "frameworks";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "vectors", label: "Threat Vectors" },
  { key: "findings", label: "Findings" },
  { key: "frameworks", label: "Frameworks & Controls" },
];

function statusRank(s: string): number {
  const i = FINDING_STATUSES.indexOf(s as FindingStatus);
  return i < 0 ? 99 : i;
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir: Dir;
  onClick: () => void;
  className?: string;
}) {
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground"
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )
        ) : (
          <ChevronsUpDown className="size-3.5 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}

export function ReportView({ data, markdown }: { data: ReportData; markdown: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [fSort, setFSort] = useState<{ key: FindingKey; dir: Dir }>({ key: "severity", dir: "desc" });
  const [sSort, setSSort] = useState<{ key: SummaryKey; dir: Dir }>({ key: "count", dir: "desc" });

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      toast("Markdown copied to clipboard.", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Could not copy to clipboard.", "error");
    }
  }

  const toggleFinding = (key: FindingKey) =>
    setFSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "severity" || key === "dueDate" ? "desc" : "asc" },
    );
  const toggleSummary = (key: SummaryKey) =>
    setSSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" },
    );

  const mul = (d: Dir) => (d === "asc" ? 1 : -1);
  const findings = [...data.findings].sort((a, b) => {
    const m = mul(fSort.dir);
    switch (fSort.key) {
      case "severity":
        return (SEVERITY_RANK[a.severity as Severity] - SEVERITY_RANK[b.severity as Severity]) * m;
      case "status":
        return (statusRank(a.status) - statusRank(b.status)) * m;
      case "owner":
        return (a.owner || "").localeCompare(b.owner || "") * m;
      case "dueDate":
        return (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31") * m;
    }
  });
  const summary = [...data.statusSummary].sort((a, b) => {
    const m = mul(sSort.dir);
    return sSort.key === "count"
      ? (a.count - b.count) * m
      : (statusRank(a.status) - statusRank(b.status)) * m;
  });

  const panel = (key: Tab) => cn("report-panel", tab !== key && "hidden");

  return (
    <div className="space-y-4">
      <div className="no-print flex justify-end gap-2">
        <Button variant="outline" onClick={copy}>
          <Copy className="size-4" /> {copied ? "Copied" : "Copy Markdown"}
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="size-4" /> Export PDF
        </Button>
      </div>

      <article className="print-full space-y-5 rounded-lg border bg-card p-5">
        {/* Header */}
        <header className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">Threat Model Report — {data.name}</h1>
            <ProjectStatusBadge status={data.status} />
          </div>
          <p className="text-sm text-muted-foreground">Generated {data.generatedAt}</p>
        </header>

        {/* Tab bar (hidden in print; every panel prints) */}
        <div className="no-print flex flex-wrap gap-1 border-b">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-pressed={tab === t.key}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                tab === t.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        <section className={panel("overview")}>
          <div className="space-y-5">
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Executive Summary
              </h2>
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  { label: "Trust boundaries", value: data.boundaryCount },
                  { label: "Threat vectors", value: data.vectorCount },
                  { label: "Open findings", value: `${data.openCount}/${data.findingCount}` },
                  { label: "Completion", value: `${data.completionPct}%` },
                ].map((s) => (
                  <div key={s.label} className="rounded-md border p-3">
                    <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>
              {data.description ? <p className="mt-3 text-sm">{data.description}</p> : null}
              {data.mcpServerUrl ? (
                <p className="mt-2 text-sm">
                  <span className="text-muted-foreground">MCP server: </span>
                  <span className="font-mono">{data.mcpServerUrl}</span>
                </p>
              ) : null}
              {data.architecture ? (
                <div className="mt-3">
                  <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                    Architecture Notes
                  </h3>
                  <div className="rounded-md border bg-muted/30 p-3 text-sm">
                    <Markdown source={data.architecture} />
                  </div>
                </div>
              ) : null}
            </div>

            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Trust Boundary Map
              </h2>
              {data.boundaries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No trust boundaries defined.</p>
              ) : (
                <div className="space-y-2">
                  {data.boundaries.map((b, i) => (
                    <div key={i} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{b.label}</span>
                        <span className="rounded-sm border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {TRUST_BOUNDARY_LABELS[b.type as TrustBoundaryType] ?? b.type}
                        </span>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {b.vectors.length === 0 ? (
                          <li className="text-sm text-muted-foreground">No threat vectors.</li>
                        ) : (
                          b.vectors.map((v, vi) => (
                            <li key={vi} className="flex flex-wrap items-center gap-1.5 text-sm">
                              <span>{v.title}</span>
                              <StrideBadge category={v.strideCategory} />
                              <McpCategoryBadge category={v.mcpCategory} />
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Mitigation Status
              </h2>
              <div className="max-w-sm overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortHeader
                        label="Status"
                        active={sSort.key === "status"}
                        dir={sSort.dir}
                        onClick={() => toggleSummary("status")}
                      />
                      <SortHeader
                        label="Count"
                        active={sSort.key === "count"}
                        dir={sSort.dir}
                        onClick={() => toggleSummary("count")}
                      />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.map((row) => (
                      <TableRow key={row.status}>
                        <TableCell>
                          <StatusPill status={row.status} />
                        </TableCell>
                        <TableCell className="font-medium tabular-nums">{row.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="mt-2 text-sm">
                <span className="text-muted-foreground">Overall completion: </span>
                <span className="font-semibold">{data.completionPct}%</span>
              </p>
            </div>
          </div>
        </section>

        {/* Threat Vectors */}
        <section className={panel("vectors")}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Threat Vectors
          </h2>
          {data.vectors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No threat vectors mapped.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Threat Vector</TableHead>
                    <TableHead>STRIDE</TableHead>
                    <TableHead>MCP Category</TableHead>
                    <TableHead>Likelihood</TableHead>
                    <TableHead>Impact</TableHead>
                    <TableHead>Risk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.vectors.map((v, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{v.title}</TableCell>
                      <TableCell>
                        <StrideBadge category={v.strideCategory} />
                      </TableCell>
                      <TableCell>
                        <McpCategoryBadge category={v.mcpCategory} />
                      </TableCell>
                      <TableCell>
                        <RiskBadge level={v.likelihood} />
                      </TableCell>
                      <TableCell>
                        <RiskBadge level={v.impact} />
                      </TableCell>
                      <TableCell>
                        <Badge className={RISK_BAND_CLASSES[v.risk as RiskBand]}>
                          {RISK_BAND_LABELS[v.risk as RiskBand]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        {/* Findings */}
        <section className={panel("findings")}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Findings
          </h2>
          {findings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No findings recorded.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHeader label="Severity" active={fSort.key === "severity"} dir={fSort.dir} onClick={() => toggleFinding("severity")} />
                    <SortHeader label="Status" active={fSort.key === "status"} dir={fSort.dir} onClick={() => toggleFinding("status")} />
                    <TableHead>Finding</TableHead>
                    <SortHeader label="Owner" active={fSort.key === "owner"} dir={fSort.dir} onClick={() => toggleFinding("owner")} />
                    <SortHeader label="Due" active={fSort.key === "dueDate"} dir={fSort.dir} onClick={() => toggleFinding("dueDate")} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {findings.map((f, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <SeverityBadge severity={f.severity} />
                      </TableCell>
                      <TableCell>
                        <StatusPill status={f.status} />
                      </TableCell>
                      <TableCell className="font-medium">{f.title}</TableCell>
                      <TableCell className="text-muted-foreground">{f.owner || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                        {f.dueDate ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        {/* Frameworks & Controls */}
        <section className={panel("frameworks")}>
          <div className="space-y-5">
            {data.frameworks.owasp.length > 0 || data.frameworks.atlas.length > 0 ? (
              <div>
                <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Framework Coverage
                </h2>
                <p className="mb-2 text-xs text-muted-foreground">
                  Indicative cross-reference of this project&apos;s threat vectors to industry
                  frameworks.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="mb-1.5 text-sm font-medium">OWASP Top 10 for LLM Apps</div>
                    <ul className="space-y-1 text-sm">
                      {data.frameworks.owasp.map((i) => (
                        <li key={i.id}>
                          <a
                            href={i.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            <span className="font-mono text-xs text-muted-foreground">{i.id}</span>{" "}
                            {i.name}
                            <ExternalLink className="size-3 opacity-60" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="mb-1.5 text-sm font-medium">MITRE ATLAS</div>
                    <ul className="space-y-1 text-sm">
                      {data.frameworks.atlas.map((i) => (
                        <li key={i.id}>
                          <a
                            href={i.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            <span className="font-mono text-xs text-muted-foreground">{i.id}</span>{" "}
                            {i.name}
                            <ExternalLink className="size-3 opacity-60" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}

            {data.presentCategories.length > 0 ? (
              <div>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Recommended Controls by MCP Category
                </h2>
                <div className="space-y-3">
                  {data.presentCategories.map((cat) => {
                    const kb = getKnowledge(cat as McpCategory);
                    if (!kb) return null;
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <McpCategoryBadge category={cat} />
                          <span className="text-sm font-medium">{kb.title}</span>
                        </div>
                        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-muted-foreground/60">
                          {kb.mitigations.map((m) => (
                            <li key={m} className="pl-1">
                              {m}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </article>
    </div>
  );
}
