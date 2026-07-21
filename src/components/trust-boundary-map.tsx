"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SeverityBadge, StatusPill } from "@/components/shared/badges";
import { findingColor } from "@/lib/finding-colors";
import {
  MCP_CATEGORY_LABELS,
  STRIDE_LABELS,
  TRUST_BOUNDARY_LABELS,
  type McpCategory,
  type StrideCategory,
  type TrustBoundaryType,
} from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

export interface MapFinding {
  id: string;
  title: string;
  severity: string;
  status: string;
  description: string;
  recommendation: string;
  threatVector: {
    mcpCategory: string;
    strideCategory: string;
    trustBoundary: { type: string } | null;
  } | null;
}

interface Props {
  projectId: string;
  findings: MapFinding[];
  threatModel?: { boundaries?: unknown[] } | null;
}

// Cluster anchor + per-index offset for each trust-boundary type. EXTERNAL findings
// fall in with the MCP↔Tools cluster.
const CLUSTERS: Record<string, { x: number; y: number; dx: number; dy: number }> = {
  LLM_TO_MCP: { x: 268, y: 172, dx: 22, dy: 15 },
  MCP_TO_USER: { x: 412, y: 172, dx: -22, dy: 15 },
  MCP_TO_TOOL: { x: 300, y: 340, dx: 47, dy: 0 },
  EXTERNAL: { x: 300, y: 366, dx: 47, dy: 0 },
  TOOL_OUTPUT_TO_LLM: { x: 52, y: 356, dx: 0, dy: -44 },
};

type Filter = { key: string; label: string; test: (f: MapFinding) => boolean };
const FILTERS: Filter[] = [
  { key: "all", label: "All", test: () => true },
  { key: "CRITICAL", label: "Critical", test: (f) => f.severity === "CRITICAL" },
  { key: "HIGH", label: "High", test: (f) => f.severity === "HIGH" },
  { key: "MEDIUM", label: "Medium", test: (f) => f.severity === "MEDIUM" },
  { key: "OPEN", label: "Open", test: (f) => f.status === "OPEN" },
  { key: "IN_PROGRESS", label: "In Progress", test: (f) => f.status === "IN_PROGRESS" },
  { key: "MITIGATED", label: "Mitigated", test: (f) => f.status === "MITIGATED" },
  { key: "TOOL_POISONING", label: "Tool Poisoning", test: (f) => f.threatVector?.mcpCategory === "TOOL_POISONING" },
  { key: "SSRF", label: "SSRF", test: (f) => f.threatVector?.mcpCategory === "SSRF" },
  { key: "SUPPLY_CHAIN", label: "Supply Chain", test: (f) => f.threatVector?.mcpCategory === "SUPPLY_CHAIN" },
  { key: "DATA_EXFILTRATION", label: "Data Exfiltration", test: (f) => f.threatVector?.mcpCategory === "DATA_EXFILTRATION" },
];

const ink = { fill: "hsl(var(--foreground))" };
const muted = { fill: "hsl(var(--muted-foreground))" };
const zoneStyle = { fill: "hsl(var(--muted))", stroke: "hsl(var(--border))" };
const mcpStyle = { fill: "hsl(var(--accent) / 0.10)", stroke: "hsl(var(--accent) / 0.45)" };
const boundaryStroke = "hsl(var(--muted-foreground) / 0.55)";
const arrowStroke = "hsl(var(--muted-foreground) / 0.6)";
const RED = "#E24B4A";

function ZoneLabel({ x, y, children, primary }: { x: number; y: number; children: string; primary?: boolean }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      style={{ ...(primary ? ink : {}), fontSize: "12.5px", fontWeight: 600 }}
    >
      {children}
    </text>
  );
}

export function TrustBoundaryMap({ projectId, findings }: Props) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState("all");
  const [hover, setHover] = useState<{ f: MapFinding; left: number; top: number } | null>(null);

  const activeFilter = FILTERS.find((x) => x.key === active) ?? FILTERS[0];

  const positioned = useMemo(() => {
    const counters: Record<string, number> = {};
    return findings.map((f, gi) => {
      const tb = f.threatVector?.trustBoundary?.type ?? "MCP_TO_TOOL";
      const cfg = CLUSTERS[tb] ?? CLUSTERS.MCP_TO_TOOL;
      const i = counters[tb] ?? 0;
      counters[tb] = i + 1;
      return { f, index: gi + 1, x: cfg.x + i * cfg.dx, y: cfg.y + i * cfg.dy };
    });
  }, [findings]);

  function showTip(f: MapFinding, e: React.MouseEvent) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.min(Math.max(e.clientX - rect.left + 14, 8), rect.width - 268);
    const top = Math.max(e.clientY - rect.top + 12, 8);
    setHover({ f, left, top });
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setActive(f.key)}
            aria-pressed={active === f.key}
            className={cn(
              "rounded-sm border px-2.5 py-1 text-xs font-medium transition-colors",
              active === f.key
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div ref={wrapRef} className="relative">
        <svg
          viewBox="0 0 680 520"
          width="100%"
          className="block h-auto rounded-md border bg-card"
          role="img"
          aria-label="Trust boundary map of the MCP deployment with findings plotted on their boundaries"
        >
          <defs>
            <marker id="tbm-end" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto">
              <path d="M0,0 L6.5,3 L0,6 z" style={{ fill: arrowStroke }} />
            </marker>
            <marker id="tbm-start" markerWidth="9" markerHeight="9" refX="0" refY="3" orient="auto-start-reverse">
              <path d="M0,0 L6.5,3 L0,6 z" style={{ fill: arrowStroke }} />
            </marker>
            <marker id="tbm-red" markerWidth="10" markerHeight="10" refX="7" refY="3.5" orient="auto">
              <path d="M0,0 L7,3.5 L0,7 z" fill={RED} />
            </marker>
          </defs>

          {/* Trust boundary dashed rects */}
          <g strokeDasharray="5 4" fill="none" strokeWidth={1.25} style={{ stroke: boundaryStroke }}>
            <rect x={64} y={40} width={242} height={126} rx={4} />
            <rect x={374} y={40} width={242} height={126} rx={4} />
            <rect x={28} y={378} width={624} height={116} rx={4} />
          </g>
          <g style={{ ...muted, fontSize: "10.5px", fontWeight: 600 }}>
            <text x={70} y={35}>TB-1 · LLM ↔ MCP server</text>
            <text x={380} y={35}>TB-2 · Client ↔ MCP server</text>
            <text x={34} y={373}>TB-3 · MCP server ↔ External tools</text>
          </g>

          {/* Zone boxes */}
          <g strokeWidth={1.25}>
            <rect x={80} y={56} width={210} height={92} rx={3} style={zoneStyle} />
            <rect x={390} y={56} width={210} height={92} rx={3} style={zoneStyle} />
            <rect x={250} y={210} width={180} height={92} rx={3} style={mcpStyle} />
            <rect x={40} y={392} width={138} height={84} rx={3} style={zoneStyle} />
            <rect x={194} y={392} width={138} height={84} rx={3} style={zoneStyle} />
            <rect x={348} y={392} width={138} height={84} rx={3} style={zoneStyle} />
            <rect x={502} y={392} width={138} height={84} rx={3} style={zoneStyle} />
          </g>
          <ZoneLabel x={185} y={106} primary>LLM / Agent runtime</ZoneLabel>
          <ZoneLabel x={495} y={106} primary>Host app / User (client)</ZoneLabel>
          <ZoneLabel x={340} y={261} primary>MCP Server</ZoneLabel>
          <g style={{ ...ink, fontSize: "11.5px", fontWeight: 500 }}>
            <text x={109} y={438} textAnchor="middle">File system</text>
            <text x={263} y={438} textAnchor="middle">HTTP / APIs</text>
            <text x={417} y={438} textAnchor="middle">Database</text>
            <text x={571} y={438} textAnchor="middle">System cmds</text>
          </g>

          {/* Bidirectional arrows */}
          <g fill="none" strokeWidth={1.4} style={{ stroke: arrowStroke }} markerEnd="url(#tbm-end)" markerStart="url(#tbm-start)">
            <line x1={244} y1={148} x2={300} y2={210} />
            <line x1={436} y1={148} x2={380} y2={210} />
            <line x1={330} y1={302} x2={132} y2={392} />
            <line x1={336} y1={302} x2={272} y2={392} />
            <line x1={344} y1={302} x2={416} y2={392} />
            <line x1={350} y1={302} x2={556} y2={392} />
          </g>

          {/* TB-4 curved overlooked boundary */}
          <path
            d="M 96 430 C 20 384, 20 168, 78 122"
            fill="none"
            stroke={RED}
            strokeWidth={1.6}
            strokeDasharray="6 4"
            markerEnd="url(#tbm-red)"
          />
          <text
            transform="rotate(-90 20 300)"
            x={20}
            y={300}
            textAnchor="middle"
            style={{ fill: RED, fontSize: "10.5px", fontWeight: 600 }}
          >
            TB-4 · Tool output → LLM (overlooked)
          </text>

          {/* Finding dots */}
          {positioned.map(({ f, index, x, y }) => {
            const matches = activeFilter.test(f);
            const color = findingColor(f.severity, f.status);
            return (
              <g
                key={f.id}
                transform={`translate(${x} ${y})`}
                role="button"
                tabIndex={0}
                aria-label={`Finding ${index}: ${f.title}`}
                style={{ cursor: "pointer", opacity: matches ? 1 : 0.15, outline: "none" }}
                onMouseEnter={(e) => showTip(f, e)}
                onMouseMove={(e) => showTip(f, e)}
                onMouseLeave={() => setHover(null)}
                onClick={() => router.push(`/projects/${projectId}/findings?finding=${f.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/projects/${projectId}/findings?finding=${f.id}`);
                  }
                }}
              >
                <circle r={10} fill={color} stroke="hsl(var(--card))" strokeWidth={1.5} />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{ fill: "#fff", fontSize: "11px", fontWeight: 700 }}
                >
                  {index}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Empty state overlay */}
        {findings.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="rounded-md border bg-background/90 px-4 py-2 text-sm text-muted-foreground shadow-sm">
              No findings yet — add threat vectors to see them mapped here
            </p>
          </div>
        ) : null}

        {/* Tooltip */}
        {hover ? (
          <div
            className="pointer-events-none absolute z-20 w-64 rounded-md border bg-popover p-3 shadow-lg"
            style={{ left: hover.left, top: hover.top }}
          >
            <p className="text-sm font-semibold leading-snug">{hover.f.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {[
                hover.f.threatVector?.trustBoundary
                  ? TRUST_BOUNDARY_LABELS[hover.f.threatVector.trustBoundary.type as TrustBoundaryType]
                  : null,
                hover.f.threatVector
                  ? STRIDE_LABELS[hover.f.threatVector.strideCategory as StrideCategory]
                  : null,
                hover.f.threatVector
                  ? MCP_CATEGORY_LABELS[hover.f.threatVector.mcpCategory as McpCategory]
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {hover.f.description || hover.f.recommendation ? (
              <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                {hover.f.description || hover.f.recommendation}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <SeverityBadge severity={hover.f.severity} />
              <StatusPill status={hover.f.status} />
            </div>
          </div>
        ) : null}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <LegendDot color="#E24B4A" label="Critical / High" />
        <LegendDot color="#EF9F27" label="Medium" />
        <LegendDot color="#378ADD" label="Low / Info" />
        <LegendDot color="#1D9E75" label="Mitigated" />
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-6 border-t border-dashed border-muted-foreground/60" />
          Trust boundary
        </span>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
