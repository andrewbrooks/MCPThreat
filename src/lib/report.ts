import { frameworksForCategories, type FrameworkItem } from "@/lib/frameworks";
import { getKnowledge } from "@/lib/mcp-knowledge-base";
import { riskBand, riskScore } from "@/lib/risk";
import {
  completionPct,
  openFindingCount,
  sortBySeverityDesc,
  statusBreakdown,
} from "@/lib/metrics";
import {
  MCP_CATEGORY_LABELS,
  PROJECT_STATUS_LABELS,
  RISK_LEVEL_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS,
  STRIDE_LABELS,
  TRUST_BOUNDARY_LABELS,
  type McpCategory,
  type ProjectStatus,
  type Severity,
  type StrideCategory,
  type TrustBoundaryType,
} from "@/lib/taxonomy";

// Report input shape — matches the Prisma include used by the report route/page.
export interface ReportFinding {
  title: string;
  severity: string;
  status: string;
  owner: string;
  dueDate: Date | null;
  recommendation: string;
  threatVectorId: string;
}
export interface ReportVector {
  id: string;
  title: string;
  strideCategory: string;
  mcpCategory: string;
  likelihood: string;
  impact: string;
  trustBoundaryId: string;
}
export interface ReportBoundary {
  id: string;
  label: string;
  type: string;
  description: string;
  vectors: ReportVector[];
}
export interface ReportProject {
  name: string;
  description: string;
  mcpServerUrl: string | null;
  architecture: string;
  status: string;
  boundaries: ReportBoundary[];
  findings: ReportFinding[];
}

function label<T extends string>(map: Record<T, string>, key: string): string {
  return (map as Record<string, string>)[key] ?? key;
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 10);
}

// Structured view of the report for rich, interactive on-page rendering (badges +
// sortable tables). The markdown from generateReport remains the copy/export artifact.
export interface ReportData {
  name: string;
  status: string;
  description: string;
  mcpServerUrl: string | null;
  architecture: string;
  generatedAt: string;
  boundaryCount: number;
  vectorCount: number;
  findingCount: number;
  openCount: number;
  completionPct: number;
  boundaries: {
    label: string;
    type: string;
    description: string;
    vectors: { title: string; strideCategory: string; mcpCategory: string }[];
  }[];
  vectors: {
    title: string;
    strideCategory: string;
    mcpCategory: string;
    likelihood: string;
    impact: string;
    risk: string;
  }[];
  findings: {
    title: string;
    severity: string;
    status: string;
    owner: string;
    dueDate: string | null;
  }[];
  statusSummary: { status: string; count: number }[];
  presentCategories: string[];
  frameworks: { owasp: FrameworkItem[]; atlas: FrameworkItem[] };
}

export function buildReportData(project: ReportProject, generatedAt = new Date()): ReportData {
  const vectors = project.boundaries.flatMap((b) => b.vectors);
  const statuses = statusBreakdown(project.findings);
  return {
    name: project.name,
    status: project.status,
    description: project.description,
    mcpServerUrl: project.mcpServerUrl,
    architecture: project.architecture,
    generatedAt: generatedAt.toISOString().slice(0, 10),
    boundaryCount: project.boundaries.length,
    vectorCount: vectors.length,
    findingCount: project.findings.length,
    openCount: openFindingCount(project.findings),
    completionPct: completionPct(vectors, project.findings),
    boundaries: project.boundaries.map((b) => ({
      label: b.label,
      type: b.type,
      description: b.description,
      vectors: b.vectors.map((v) => ({
        title: v.title,
        strideCategory: v.strideCategory,
        mcpCategory: v.mcpCategory,
      })),
    })),
    vectors: vectors.map((v) => ({
      title: v.title,
      strideCategory: v.strideCategory,
      mcpCategory: v.mcpCategory,
      likelihood: v.likelihood,
      impact: v.impact,
      risk: riskBand(riskScore(v.likelihood, v.impact)),
    })),
    findings: project.findings.map((f) => ({
      title: f.title,
      severity: f.severity,
      status: f.status,
      owner: f.owner,
      dueDate: f.dueDate ? new Date(f.dueDate).toISOString().slice(0, 10) : null,
    })),
    statusSummary: Object.entries(statuses).map(([status, count]) => ({ status, count })),
    presentCategories: Array.from(new Set(vectors.map((v) => v.mcpCategory))),
    frameworks: frameworksForCategories(
      Array.from(new Set(vectors.map((v) => v.mcpCategory))),
    ),
  };
}

export function generateReport(project: ReportProject, generatedAt = new Date()): string {
  const vectors = project.boundaries.flatMap((b) => b.vectors);
  const pct = completionPct(vectors, project.findings);
  const openCount = openFindingCount(project.findings);
  const statuses = statusBreakdown(project.findings);
  const lines: string[] = [];

  lines.push(`# Threat Model Report — ${project.name}`);
  lines.push("");
  lines.push(`_Generated ${generatedAt.toISOString().slice(0, 10)}_`);
  lines.push("");

  // Executive summary
  lines.push("## Executive Summary");
  lines.push("");
  lines.push(
    `**${project.name}** (${label<ProjectStatus>(PROJECT_STATUS_LABELS, project.status)}) has ` +
      `**${project.boundaries.length}** trust boundaries, **${vectors.length}** mapped threat vectors, ` +
      `and **${project.findings.length}** findings (**${openCount}** open). ` +
      `Mitigation completion is **${pct}%** — the share of threat vectors with at least one mitigated or closed finding.`,
  );
  lines.push("");
  if (project.description) {
    lines.push(project.description);
    lines.push("");
  }
  if (project.mcpServerUrl) {
    lines.push(`**MCP server:** ${project.mcpServerUrl}`);
    lines.push("");
  }
  if (project.architecture) {
    lines.push("### Architecture Notes");
    lines.push("");
    lines.push(project.architecture);
    lines.push("");
  }

  // Trust boundary map (text-based)
  lines.push("## Trust Boundary Map");
  lines.push("");
  if (project.boundaries.length === 0) {
    lines.push("_No trust boundaries defined._");
    lines.push("");
  } else {
    for (const b of project.boundaries) {
      lines.push(`### ${b.label}  \`${label<TrustBoundaryType>(TRUST_BOUNDARY_LABELS, b.type)}\``);
      if (b.description) lines.push(`> ${b.description}`);
      if (b.vectors.length === 0) {
        lines.push("- _(no threat vectors)_");
      } else {
        for (const v of b.vectors) {
          lines.push(
            `- **${v.title}** — ${label<StrideCategory>(STRIDE_LABELS, v.strideCategory)} / ` +
              `${label<McpCategory>(MCP_CATEGORY_LABELS, v.mcpCategory)}`,
          );
        }
      }
      lines.push("");
    }
  }

  // Threat vector table
  lines.push("## Threat Vectors");
  lines.push("");
  if (vectors.length === 0) {
    lines.push("_No threat vectors mapped._");
    lines.push("");
  } else {
    lines.push("| Threat Vector | STRIDE | MCP Category | Likelihood | Impact |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const v of vectors) {
      lines.push(
        `| ${v.title} | ${label<StrideCategory>(STRIDE_LABELS, v.strideCategory)} | ` +
          `${label<McpCategory>(MCP_CATEGORY_LABELS, v.mcpCategory)} | ` +
          `${label(RISK_LEVEL_LABELS, v.likelihood)} | ${label(RISK_LEVEL_LABELS, v.impact)} |`,
      );
    }
    lines.push("");
  }

  // Findings table sorted by severity
  lines.push("## Findings");
  lines.push("");
  if (project.findings.length === 0) {
    lines.push("_No findings recorded._");
    lines.push("");
  } else {
    lines.push("| Severity | Status | Finding | Owner | Due |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const f of sortBySeverityDesc(project.findings)) {
      lines.push(
        `| ${label<Severity>(SEVERITY_LABELS, f.severity)} | ${label(STATUS_LABELS, f.status)} | ` +
          `${f.title} | ${f.owner || "—"} | ${fmtDate(f.dueDate)} |`,
      );
    }
    lines.push("");
  }

  // Mitigation status summary
  lines.push("## Mitigation Status Summary");
  lines.push("");
  lines.push("| Status | Count |");
  lines.push("| --- | --- |");
  for (const [status, count] of Object.entries(statuses)) {
    lines.push(`| ${label(STATUS_LABELS, status)} | ${count} |`);
  }
  lines.push("");
  lines.push(`**Overall completion:** ${pct}%`);
  lines.push("");

  // Recommended controls, keyed off the MCP categories present in the model.
  const presentCategories = Array.from(new Set(vectors.map((v) => v.mcpCategory)));
  if (presentCategories.length > 0) {
    lines.push("## Recommended Controls by MCP Category");
    lines.push("");
    for (const cat of presentCategories) {
      const kb = getKnowledge(cat as McpCategory);
      if (!kb) continue;
      lines.push(`### ${kb.title}`);
      lines.push("");
      for (const m of kb.mitigations) lines.push(`- ${m}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}
