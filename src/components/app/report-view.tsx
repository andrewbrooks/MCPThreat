"use client";

import { ChevronDown, ChevronsUpDown, ChevronUp, Copy, Download, ExternalLink, Printer } from "lucide-react";
import * as React from "react";
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
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import {
  count,
  LIVE_DRAFT_NOTICE,
  REQUIREMENT_LABELS,
  SNAPSHOT_INTEGRITY_TEXT,
  SNAPSHOT_STATUS_LABELS,
  type Assessment,
} from "@/lib/assessment";
import { day, utc } from "@/lib/report-format";
import { RISK_BAND_CLASSES, RISK_BAND_LABELS, type RiskBand } from "@/lib/risk";
import {
  FINDING_STATUSES,
  PARTY_SIDE_LABELS,
  SEVERITY_RANK,
  type FindingStatus,
  type PartySide,
  type Severity,
} from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

type Dir = "asc" | "desc";
type FindingKey = "id" | "severity" | "status" | "owner" | "dueDate";
type Tab = "overview" | "vectors" | "findings" | "frameworks";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "vectors", label: "Threat vectors" },
  { key: "findings", label: "Findings" },
  { key: "frameworks", label: "Frameworks and controls" },
];

const H2 = "mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground";

function Dl({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[11rem_1fr]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

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

export function ReportView({ data }: { data: Assessment }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [fSort, setFSort] = useState<{ key: FindingKey; dir: Dir }>({ key: "severity", dir: "desc" });
  const r = data.record;
  const s = data.summary;
  const base = `/api/projects/${r.projectId}/report`;

  async function copy() {
    try {
      const res = await fetch(`${base}?format=md`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await navigator.clipboard.writeText(await res.text());
      setCopied(true);
      toast("Markdown copied to clipboard.", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Could not copy to the clipboard. Use the Markdown download instead.", "error");
    }
  }

  const toggleFinding = (key: FindingKey) =>
    setFSort((cur) =>
      cur.key === key
        ? { key, dir: cur.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "severity" || key === "dueDate" ? "desc" : "asc" },
    );

  const mul = fSort.dir === "asc" ? 1 : -1;
  const findings = [...data.findings].sort((a, b) => {
    switch (fSort.key) {
      case "id":
        return a.id.localeCompare(b.id) * mul;
      case "severity":
        return (
          ((SEVERITY_RANK[a.severity as Severity] ?? 0) - (SEVERITY_RANK[b.severity as Severity] ?? 0)) *
            mul || a.id.localeCompare(b.id)
        );
      case "status":
        return (statusRank(a.status) - statusRank(b.status)) * mul || a.id.localeCompare(b.id);
      case "owner":
        return (a.owner || "").localeCompare(b.owner || "") * mul || a.id.localeCompare(b.id);
      case "dueDate":
        return (
          (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31") * mul ||
          a.id.localeCompare(b.id)
        );
    }
  });
  const statusRows = s.byStatus.filter(
    (x) => x.count > 0 || x.status !== "PENDING_ACCEPTANCE" || r.acceptancePolicy.value !== "OFF",
  );

  const panel = (key: Tab) => cn("report-panel", tab !== key && "hidden");
  const tabProps = (key: Tab) => ({
    id: `report-panel-${key}`,
    role: "tabpanel" as const,
    "aria-labelledby": `report-tab-${key}`,
    tabIndex: 0,
    className: cn(panel(key), "focus-visible:outline-none"),
  });
  function onTabKey(e: React.KeyboardEvent, i: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? TABS.length - 1
          : (i + (e.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    setTab(TABS[next].key);
    document.getElementById(`report-tab-${TABS[next].key}`)?.focus();
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Download report">
          <span className="text-sm text-muted-foreground">Download:</span>
          {[
            { f: "html", label: "HTML" },
            { f: "md", label: "Markdown" },
            { f: "json", label: "JSON" },
            { f: "csv", label: "Findings CSV" },
          ].map((d) => (
            <a
              key={d.f}
              href={`${base}?format=${d.f}&download=1`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Download className="size-4" aria-hidden="true" /> {d.label}
            </a>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copy}>
            <Copy className="size-4" aria-hidden="true" /> {copied ? "Copied" : "Copy Markdown"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden="true" /> Print or save as PDF
          </Button>
        </div>
      </div>

      <article className="print-full space-y-5 rounded-lg border bg-card p-5">
        <header className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">
              Threat Model Report: {r.projectName}
            </h1>
            <ProjectStatusBadge status={r.projectStatus} />
          </div>
          <p className="text-sm text-muted-foreground">
            Prepared with {data.tool.name} {data.tool.version} on {utc(data.generatedAt)}. Report
            format version {data.schemaVersion}.
          </p>
        </header>

        {data.snapshot ? (
          <div
            role={data.snapshot.integrity === "FAILED" ? "alert" : "note"}
            className={cn(
              "rounded-md border p-3 text-sm",
              data.snapshot.integrity === "FAILED"
                ? "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
                : "border-border bg-muted/40",
            )}
          >
            <strong>Snapshot v{data.snapshot.version}</strong>,{" "}
            {SNAPSHOT_STATUS_LABELS[data.snapshot.status] ?? data.snapshot.status}.
            {data.snapshot.integrity === "FAILED" ? (
              <>
                {" "}
                <strong>Integrity check failed.</strong> {SNAPSHOT_INTEGRITY_TEXT.FAILED}
              </>
            ) : null}
          </div>
        ) : (
          <div
            role="note"
            className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <strong>Live draft.</strong> {LIVE_DRAFT_NOTICE}
          </div>
        )}

        <div role="tablist" aria-label="Report sections" className="no-print flex flex-wrap gap-1 border-b">
          {TABS.map((t, i) => (
            <button
              key={t.key}
              id={`report-tab-${t.key}`}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              aria-controls={`report-panel-${t.key}`}
              tabIndex={tab === t.key ? 0 : -1}
              onClick={() => setTab(t.key)}
              onKeyDown={(e) => onTabKey(e, i)}
              className={cn(
                "-mb-px rounded-t-sm border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
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
        <section {...tabProps("overview")}>
          <div className="space-y-6">
            <div>
              <h2 className={H2}>Summary</h2>
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  { label: "Trust boundaries", value: String(s.boundaryCount) },
                  { label: "Threat vectors", value: String(s.vectorCount) },
                  { label: `Open findings, of ${s.findingCount}`, value: String(s.openCount) },
                  { label: "Mitigation completion", value: `${s.completionPct}%` },
                ].map((t) => (
                  <div key={t.label} className="rounded-md border p-3">
                    <div className="text-2xl font-semibold tabular-nums">{t.value}</div>
                    <div className="text-xs text-muted-foreground">{t.label}</div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Open means Open, In Progress, or Pending Acceptance. Completion is the share of
                threat vectors with at least one Mitigated or Closed finding. See Definitions below.
              </p>
              {r.projectDescription ? <p className="mt-3 text-sm">{r.projectDescription}</p> : null}
            </div>

            <div>
              <h2 className={H2}>Scope and limitations</h2>
              <div
                role="note"
                className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
              >
                {data.scope.statements.map((t) => (
                  <p key={t}>{t}</p>
                ))}
                <p className="font-medium">Please read before relying on this report.</p>
                <ul className="list-disc space-y-1 pl-5">
                  {data.scope.limitations.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <h2 className={H2}>Assessment record</h2>
              {data.snapshot ? (
                <div className="mb-4 space-y-2">
                  <h3 className="text-sm font-semibold">Snapshot record</h3>
                  <Dl
                    rows={[
                      ["Snapshot version", String(data.snapshot.version)],
                      ["Issued by", data.snapshot.issuedBy],
                      ["Issued at", utc(data.snapshot.issuedAt)],
                      ["Note", data.snapshot.note.trim() || "—"],
                      [
                        "Content hash (SHA-256)",
                        <span key="h" className="break-all font-mono text-xs">
                          {data.snapshot.contentHash}
                        </span>,
                      ],
                      [
                        "Review requirement",
                        REQUIREMENT_LABELS[data.snapshot.requirement] ?? data.snapshot.requirement,
                      ],
                      [
                        "Review status",
                        SNAPSHOT_STATUS_LABELS[data.snapshot.status] ?? data.snapshot.status,
                      ],
                      ["Integrity check", SNAPSHOT_INTEGRITY_TEXT[data.snapshot.integrity]],
                    ]}
                  />
                  {data.snapshot.signoffs.length ? (
                    <ul className="space-y-1 text-sm">
                      {data.snapshot.signoffs.map((so, i) => (
                        <li key={i}>
                          <strong>{PARTY_SIDE_LABELS[so.side as PartySide] ?? so.side}:</strong>{" "}
                          {so.decision === "APPROVED" ? "Approved" : "Returned for changes"} by {so.by},{" "}
                          {utc(so.at)}.{so.comment ? ` ${so.comment}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No sign-offs have been recorded.</p>
                  )}
                </div>
              ) : null}
              <Dl
                rows={[
                  ["Project", r.projectName],
                  ["MCP server", r.mcpServerUrl ? <span className="font-mono">{r.mcpServerUrl}</span> : "—"],
                  [
                    "Model source",
                    r.source.type === "GITHUB"
                      ? "Imported from GitHub, then reviewed in MCPThreat"
                      : "Entered manually in MCPThreat",
                  ],
                  ...(r.source.type === "GITHUB"
                    ? ([
                        ["Repository", <span key="repo" className="font-mono">{r.source.repoUrl ?? "—"}</span>],
                        ["Repository ref", r.source.repoRef ?? "Default branch at import time"],
                        ["Analysis run", utc(r.source.analyzedAt)],
                        ["AI model", "Not recorded (configured per deployment, not stored with the analysis)"],
                      ] as [string, React.ReactNode][])
                    : []),
                  ...(r.source.techStack.length
                    ? ([["Technology", r.source.techStack.join(", ")]] as [string, React.ReactNode][])
                    : []),
                  ["Model created", utc(r.createdAt)],
                  ["Last change recorded", utc(r.lastUpdatedAt)],
                  ["Report generated", utc(data.generatedAt)],
                  ["Tool and version", `${data.tool.name} ${data.tool.version}`],
                  ["Risk-acceptance policy", r.acceptancePolicy.label],
                  [
                    "AI-suggested items",
                    `${count(r.aiSuggested.boundaries, "boundary", "boundaries")}, ${count(r.aiSuggested.vectors, "threat vector")}, ${count(r.aiSuggested.findings, "finding")}`,
                  ],
                  [
                    "Audit trail",
                    count(r.audit.eventCount, "event") +
                      (r.audit.firstEventAt
                        ? `, ${utc(r.audit.firstEventAt)} to ${utc(r.audit.lastEventAt)}`
                        : ""),
                  ],
                  [
                    "People with access",
                    r.people.length ? (
                      <ul>
                        {r.people.map((p) => (
                          <li key={p.label}>
                            {p.label}{" "}
                            <span className="text-muted-foreground">
                              ({p.role}, {PARTY_SIDE_LABELS[p.side as PartySide] ?? p.side})
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      "—"
                    ),
                  ],
                ]}
              />
            </div>

            {data.architecture ? (
              <div>
                <h2 className={H2}>Architecture</h2>
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <Markdown source={data.architecture} />
                </div>
              </div>
            ) : null}

            <div>
              <h2 className={H2}>Trust boundaries</h2>
              {data.boundaries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No trust boundaries defined.</p>
              ) : (
                <div className="space-y-2">
                  {data.boundaries.map((b) => (
                    <div key={b.id} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{b.id}</span>
                        <span className="font-medium">{b.label}</span>
                        <span className="rounded-sm border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {b.typeLabel}
                        </span>
                        {b.source === "AI" ? (
                          <Badge className="border-violet-300 text-violet-800 dark:text-violet-300">
                            AI-suggested
                          </Badge>
                        ) : null}
                      </div>
                      <ul className="mt-2 space-y-1">
                        {b.vectorIds.length === 0 ? (
                          <li className="text-sm text-muted-foreground">No threat vectors recorded.</li>
                        ) : (
                          b.vectorIds.map((vid) => {
                            const v = data.vectors.find((x) => x.id === vid)!;
                            return (
                              <li key={vid} className="flex flex-wrap items-center gap-1.5 text-sm">
                                <span className="font-mono text-xs text-muted-foreground">{v.id}</span>
                                <span>{v.title}</span>
                                <StrideBadge category={v.strideCategory} />
                                <McpCategoryBadge category={v.mcpCategory} />
                              </li>
                            );
                          })
                        )}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className={H2}>Findings by severity and status</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <caption className="sr-only">Findings by severity</caption>
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">Severity</TableHead>
                        <TableHead scope="col">Total</TableHead>
                        <TableHead scope="col">Open</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {s.bySeverity.map((row) => (
                        <TableRow key={row.severity}>
                          <TableCell>
                            <SeverityBadge severity={row.severity} />
                          </TableCell>
                          <TableCell className="tabular-nums">{row.total}</TableCell>
                          <TableCell className="tabular-nums">{row.open}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <caption className="sr-only">Findings by status</caption>
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">Status</TableHead>
                        <TableHead scope="col">Findings</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statusRows.map((row) => (
                        <TableRow key={row.status}>
                          <TableCell>
                            <StatusPill status={row.status} />
                          </TableCell>
                          <TableCell className="tabular-nums">{row.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            <div>
              <h2 className={H2}>Definitions</h2>
              <dl className="space-y-1.5 text-sm">
                {data.definitions.map((d) => (
                  <div key={d.term}>
                    <dt className="inline font-medium">{d.term}. </dt>
                    <dd className="inline text-muted-foreground">{d.text}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* Threat vectors */}
        <section {...tabProps("vectors")}>
          <h2 className={H2}>Threat vectors</h2>
          {data.vectors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No threat vectors mapped.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">ID</TableHead>
                    <TableHead scope="col">Threat vector</TableHead>
                    <TableHead scope="col">STRIDE</TableHead>
                    <TableHead scope="col">MCP category</TableHead>
                    <TableHead scope="col">Likelihood</TableHead>
                    <TableHead scope="col">Impact</TableHead>
                    <TableHead scope="col">Risk</TableHead>
                    <TableHead scope="col">Residual</TableHead>
                    <TableHead scope="col">Findings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.vectors.map((v) => (
                    <TableRow key={v.id} id={v.id}>
                      <TableCell className="whitespace-nowrap font-mono text-xs">{v.id}</TableCell>
                      <TableCell className="font-medium">
                        {v.title}
                        {v.source === "AI" ? (
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            AI-suggested{v.confidence ? `, ${v.confidence.toLowerCase()} confidence` : ""}
                          </span>
                        ) : null}
                      </TableCell>
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
                        <Badge className={RISK_BAND_CLASSES[v.riskBand as RiskBand]}>
                          {RISK_BAND_LABELS[v.riskBand as RiskBand]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={RISK_BAND_CLASSES[v.residualBand as RiskBand]}>
                          {RISK_BAND_LABELS[v.residualBand as RiskBand]}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {v.findingIds.join(", ") || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        {/* Findings */}
        <section {...tabProps("findings")}>
          <h2 className={H2}>Findings register</h2>
          {findings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No findings recorded.</p>
          ) : (
            <div className="space-y-6">
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortHeader label="ID" active={fSort.key === "id"} dir={fSort.dir} onClick={() => toggleFinding("id")} />
                      <SortHeader label="Severity" active={fSort.key === "severity"} dir={fSort.dir} onClick={() => toggleFinding("severity")} />
                      <SortHeader label="Status" active={fSort.key === "status"} dir={fSort.dir} onClick={() => toggleFinding("status")} />
                      <TableHead scope="col">Finding</TableHead>
                      <TableHead scope="col">Vector</TableHead>
                      <SortHeader label="Owner" active={fSort.key === "owner"} dir={fSort.dir} onClick={() => toggleFinding("owner")} />
                      <SortHeader label="Due" active={fSort.key === "dueDate"} dir={fSort.dir} onClick={() => toggleFinding("dueDate")} />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {findings.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="whitespace-nowrap font-mono text-xs">
                          <a href={`#${f.id}`} className="underline-offset-2 hover:underline">
                            {f.id}
                          </a>
                        </TableCell>
                        <TableCell>
                          <SeverityBadge severity={f.severity} />
                        </TableCell>
                        <TableCell>
                          <StatusPill status={f.status} />
                        </TableCell>
                        <TableCell className="font-medium">{f.title}</TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs">{f.vectorId ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{f.owner || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                          {day(f.dueDate)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div>
                <h2 className={H2}>Finding details</h2>
                <div className="space-y-4">
                  {[...data.findings]
                    .sort(
                      (a, b) =>
                        (SEVERITY_RANK[b.severity as Severity] ?? 0) -
                          (SEVERITY_RANK[a.severity as Severity] ?? 0) || a.id.localeCompare(b.id),
                    )
                    .map((f) => (
                      <section
                        key={f.id}
                        id={f.id}
                        aria-labelledby={`${f.id}-title`}
                        className="scroll-mt-4 break-inside-avoid rounded-md border p-4"
                      >
                        <h3 id={`${f.id}-title`} className="flex flex-wrap items-center gap-2 font-semibold">
                          <span className="font-mono text-sm text-muted-foreground">{f.id}</span>
                          {f.title}
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <SeverityBadge severity={f.severity} />
                          <StatusPill status={f.status} />
                          {f.source === "AI" ? (
                            <Badge className="border-violet-300 text-violet-800 dark:text-violet-300">
                              AI-suggested{f.confidence ? `, ${f.confidence.toLowerCase()} confidence` : ""}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-3">
                          <Dl
                            rows={[
                              [
                                "Threat vector",
                                f.vectorId ? `${f.vectorId} ${f.vectorTitle ?? ""}${f.mcpCategoryLabel ? ` (${f.mcpCategoryLabel})` : ""}` : "—",
                              ],
                              ["Owner", f.owner || "—"],
                              ["Due", day(f.dueDate)],
                              ...(f.reviewDueAt ? ([["Review due", day(f.reviewDueAt)]] as [string, React.ReactNode][]) : []),
                              ...([...f.frameworks.owasp, ...f.frameworks.atlas].length
                                ? ([["Framework mapping (indicative)", [...f.frameworks.owasp, ...f.frameworks.atlas].join(", ")]] as [string, React.ReactNode][])
                                : []),
                              ["Recorded", utc(f.createdAt)],
                              ["Last updated", utc(f.updatedAt)],
                            ]}
                          />
                        </div>
                        <div className="mt-3 space-y-3 text-sm">
                          <div>
                            <div className="font-medium">Description and rationale</div>
                            <p className="whitespace-pre-wrap text-muted-foreground">
                              {f.description.trim() || "Not recorded."}
                            </p>
                          </div>
                          <div>
                            <div className="font-medium">Recommendation</div>
                            <p className="whitespace-pre-wrap text-muted-foreground">
                              {f.recommendation.trim() || "Not recorded."}
                            </p>
                          </div>
                          {f.evidence.trim() ? (
                            <div>
                              <div className="font-medium">Evidence</div>
                              <p className="whitespace-pre-wrap text-muted-foreground">{f.evidence}</p>
                            </div>
                          ) : null}
                          {f.attachments.length ? (
                            <div>
                              <div className="font-medium">Attachments</div>
                              <ul className="list-disc pl-5 text-muted-foreground">
                                {f.attachments.map((x) => (
                                  <li key={x.filename}>{x.filename}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {f.acceptance ? (
                            <div>
                              <div className="font-medium">Risk acceptance</div>
                              <p className="text-muted-foreground">
                                {f.acceptance.status.charAt(0) + f.acceptance.status.slice(1).toLowerCase()}, requested by{" "}
                                {f.acceptance.requestedBy || "—"} on {day(f.acceptance.requestedAt)}.
                                {f.acceptance.justification ? ` Justification: ${f.acceptance.justification}` : ""}
                                {f.acceptance.approvals.map(
                                  (ap) =>
                                    ` ${PARTY_SIDE_LABELS[ap.side as PartySide] ?? ap.side} approval: ${ap.by} on ${day(ap.at)}.`,
                                )}
                                {f.acceptance.expiresAt ? ` Expires ${day(f.acceptance.expiresAt)}.` : ""}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      </section>
                    ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Frameworks and controls */}
        <section {...tabProps("frameworks")}>
          <div className="space-y-6">
            <div>
              <h2 className={H2}>Framework mapping</h2>
              <p className="mb-3 text-sm text-muted-foreground">{data.frameworks.note}</p>
              {data.frameworks.owasp.length === 0 && data.frameworks.atlas.length === 0 ? (
                <p className="text-sm text-muted-foreground">No threat vectors to map.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">Framework</TableHead>
                        <TableHead scope="col">Reference</TableHead>
                        <TableHead scope="col">Threat vectors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        ...data.frameworks.owasp.map((i) => ({ fw: "OWASP Top 10 for LLM Applications (2025)", i, key: "owasp" as const })),
                        ...data.frameworks.atlas.map((i) => ({ fw: "MITRE ATLAS", i, key: "atlas" as const })),
                      ].map(({ fw, i, key }) => (
                        <TableRow key={`${key}-${i.id}`}>
                          <TableCell>{fw}</TableCell>
                          <TableCell>
                            <a
                              href={i.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                            >
                              <span className="font-mono text-xs">{i.id}</span> {i.name}
                              <ExternalLink className="size-3 opacity-60" aria-hidden="true" />
                              <span className="sr-only"> (opens in a new tab)</span>
                            </a>
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-mono text-xs">
                            {data.vectors
                              .filter((v) => v.frameworks[key].includes(i.id))
                              .map((v) => v.id)
                              .join(", ")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {data.controls.length > 0 ? (
              <div>
                <h2 className={H2}>Recommended controls by MCP category</h2>
                <p className="mb-3 text-sm text-muted-foreground">
                  General guidance for each MCP category present in the model. It is not specific to
                  any one finding.
                </p>
                <div className="space-y-4">
                  {data.controls.map((c) => (
                    <div key={c.category} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <McpCategoryBadge category={c.category} />
                        <h3 className="text-sm font-medium">{c.title}</h3>
                      </div>
                      <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-muted-foreground/60">
                        {c.mitigations.map((m) => (
                          <li key={m} className="pl-1">
                            {m}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </article>
    </div>
  );
}
