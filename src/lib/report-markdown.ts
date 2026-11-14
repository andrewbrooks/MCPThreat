import {
  findingsBySeverity,
  type Assessment,
  type AssessmentAcceptance,
  type AssessmentFinding,
} from "@/lib/assessment";
import { PARTY_SIDE_LABELS, type PartySide } from "@/lib/taxonomy";

// Markdown rendering of an Assessment. The same data feeds the HTML, CSV and JSON
// exports (see report-html.ts, report-csv.ts), so wording lives in assessment.ts.

const DASH = "Not recorded";

/** Escape characters that would otherwise be read as markup or break a table row. */
function esc(s: string): string {
  return s.replace(/</g, "\\<");
}
function cell(s: string | null | undefined): string {
  const v = (s ?? "").trim();
  if (!v) return "—";
  return esc(v).replace(/\|/g, "\\|").replace(/\r?\n+/g, " ");
}
function block(s: string): string {
  return esc(s.trim());
}

function utc(isoString: string | null): string {
  return isoString ? isoString.replace("T", " ").slice(0, 16) + " UTC" : DASH;
}
function date(isoString: string | null): string {
  return isoString ? isoString.slice(0, 10) : "—";
}
function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Nest an embedded markdown document under a parent heading by pushing every
 * heading down `by` levels (capped at h6), leaving fenced code untouched.
 */
export function demoteHeadings(md: string, by: number): string {
  let fenced = false;
  return md
    .split("\n")
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
      if (fenced) return line;
      const m = /^(#{1,6})(\s.*)$/.exec(line);
      if (!m) return line;
      return "#".repeat(Math.min(6, m[1].length + by)) + m[2];
    })
    .join("\n");
}

function acceptanceLines(a: AssessmentAcceptance): string[] {
  const out: string[] = [];
  out.push(`- **Acceptance request:** ${a.status.charAt(0) + a.status.slice(1).toLowerCase()}, requested by ${cell(a.requestedBy)} on ${date(a.requestedAt)}`);
  if (a.justification) out.push(`- **Justification:** ${cell(a.justification)}`);
  if (a.residualRisk) out.push(`- **Residual risk accepted:** ${cell(a.residualRisk)}`);
  for (const ap of a.approvals) {
    out.push(
      `- **${PARTY_SIDE_LABELS[ap.side as PartySide] ?? ap.side} approval:** ${cell(ap.by)} on ${date(ap.at)}`,
    );
  }
  if (a.rejection) out.push(`- **Rejected by:** ${cell(a.rejection.by)}. ${cell(a.rejection.reason)}`);
  if (a.expiresAt) out.push(`- **Acceptance expires:** ${date(a.expiresAt)}`);
  return out;
}

function findingDetail(f: AssessmentFinding, a: Assessment): string[] {
  const lines: string[] = [];
  lines.push(`### ${f.id}: ${esc(f.title)}`);
  lines.push("");
  const vec = f.vectorId ? `${f.vectorId} ${cell(f.vectorTitle)}` : "—";
  lines.push(`- **Severity:** ${f.severityLabel}`);
  lines.push(`- **Status:** ${f.statusLabel}`);
  lines.push(`- **Threat vector:** ${vec}${f.mcpCategoryLabel ? ` (${f.mcpCategoryLabel})` : ""}`);
  lines.push(`- **Owner:** ${cell(f.owner)}`);
  lines.push(`- **Due:** ${date(f.dueDate)}`);
  if (f.reviewDueAt) lines.push(`- **Review due:** ${date(f.reviewDueAt)}`);
  lines.push(
    `- **Source:** ${f.source === "AI" ? `AI-suggested${f.confidence ? `, ${f.confidence.toLowerCase()} confidence` : ""}` : "Entered by a person"}`,
  );
  const fw = [...f.frameworks.owasp, ...f.frameworks.atlas];
  if (fw.length) lines.push(`- **Framework mapping (indicative):** ${fw.join(", ")}`);
  lines.push(`- **Recorded:** ${utc(f.createdAt)}. **Last updated:** ${utc(f.updatedAt)}`);
  lines.push("");
  lines.push("**Description and rationale**");
  lines.push("");
  lines.push(f.description.trim() ? block(f.description) : "_No description recorded._");
  lines.push("");
  lines.push("**Recommendation**");
  lines.push("");
  lines.push(f.recommendation.trim() ? block(f.recommendation) : "_No recommendation recorded._");
  lines.push("");
  if (f.evidence.trim()) {
    lines.push("**Evidence**");
    lines.push("");
    lines.push(block(f.evidence));
    lines.push("");
  }
  if (f.attachments.length) {
    lines.push("**Attachments** (file contents are not included in this report)");
    lines.push("");
    for (const att of f.attachments) {
      lines.push(`- ${esc(att.filename)} (${att.mimeType}, ${fmtBytes(att.size)})`);
    }
    lines.push("");
  }
  if (f.acceptance) {
    lines.push("**Risk acceptance**");
    lines.push("");
    lines.push(...acceptanceLines(f.acceptance));
    lines.push("");
  }
  void a;
  return lines;
}

export function generateReport(a: Assessment): string {
  const r = a.record;
  const s = a.summary;
  const L: string[] = [];

  L.push(`# Threat Model Report: ${esc(r.projectName)}`);
  L.push("");
  L.push(
    `Prepared with ${a.tool.name} ${a.tool.version} on ${utc(a.generatedAt)}. ` +
      `Report format version ${a.schemaVersion}.`,
  );
  L.push("");

  L.push("## Contents");
  L.push("");
  [
    "1. Assessment record",
    "2. Scope and limitations",
    "3. Summary",
    "4. Architecture",
    "5. Trust boundaries",
    "6. Threat vectors",
    "7. Findings register",
    "8. Finding details",
    "9. Framework mapping",
    "10. Recommended controls",
    "11. Definitions",
  ].forEach((t) => L.push(t));
  L.push("");

  // 1. Record
  L.push("## 1. Assessment record");
  L.push("");
  L.push("| Item | Value |");
  L.push("| --- | --- |");
  L.push(`| Project | ${cell(r.projectName)} |`);
  L.push(`| Project status | ${r.projectStatusLabel} |`);
  if (r.projectDescription) L.push(`| Description | ${cell(r.projectDescription)} |`);
  L.push(`| MCP server | ${cell(r.mcpServerUrl)} |`);
  L.push(
    `| Model source | ${r.source.type === "GITHUB" ? "Imported from GitHub, then reviewed in MCPThreat" : "Entered manually in MCPThreat"} |`,
  );
  if (r.source.type === "GITHUB") {
    L.push(`| Repository | ${cell(r.source.repoUrl)} |`);
    L.push(`| Repository ref | ${r.source.repoRef ? cell(r.source.repoRef) : "Default branch at import time"} |`);
    L.push(`| Analysis run | ${utc(r.source.analyzedAt)} |`);
    L.push(`| AI model | ${DASH} (configured per deployment, not stored with the analysis) |`);
  }
  if (r.source.techStack.length) L.push(`| Technology | ${cell(r.source.techStack.join(", "))} |`);
  L.push(`| Model created | ${utc(r.createdAt)} |`);
  L.push(`| Last change recorded | ${utc(r.lastUpdatedAt)} |`);
  L.push(`| Report generated | ${utc(a.generatedAt)} |`);
  L.push(`| Tool and version | ${a.tool.name} ${a.tool.version} |`);
  L.push(`| Risk-acceptance policy | ${r.acceptancePolicy.label} |`);
  L.push(
    `| AI-suggested items | ${r.aiSuggested.boundaries} boundaries, ${r.aiSuggested.vectors} threat vectors, ${r.aiSuggested.findings} findings |`,
  );
  L.push(
    `| Audit trail | ${r.audit.eventCount} events` +
      (r.audit.firstEventAt ? `, ${utc(r.audit.firstEventAt)} to ${utc(r.audit.lastEventAt)}` : "") +
      " |",
  );
  L.push("");
  if (r.people.length) {
    L.push("**People with access**");
    L.push("");
    L.push("| Person | Role | Party |");
    L.push("| --- | --- | --- |");
    for (const p of r.people) {
      L.push(`| ${cell(p.label)} | ${p.role} | ${PARTY_SIDE_LABELS[p.side as PartySide] ?? p.side} |`);
    }
    L.push("");
  }

  // 2. Scope
  L.push("## 2. Scope and limitations");
  L.push("");
  a.scope.statements.forEach((t) => L.push(`${t}`, ""));
  L.push("**Limitations. Please read before relying on this report.**");
  L.push("");
  a.scope.limitations.forEach((t) => L.push(`- ${t}`));
  L.push("");

  // 3. Summary
  L.push("## 3. Summary");
  L.push("");
  L.push(
    `${esc(r.projectName)} has ${s.boundaryCount} trust boundaries, ${s.vectorCount} threat vectors, and ${s.findingCount} findings, of which ${s.openCount} are open. ` +
      `Mitigation completion is ${s.completionPct}%. Definitions of "open" and "completion" are in section 11.`,
  );
  L.push("");
  L.push("| Severity | Total | Open |");
  L.push("| --- | --- | --- |");
  for (const row of s.bySeverity) L.push(`| ${row.label} | ${row.total} | ${row.open} |`);
  L.push("");
  const shownStatuses = s.byStatus.filter(
    (x) => x.count > 0 || x.status !== "PENDING_ACCEPTANCE" || r.acceptancePolicy.value !== "OFF",
  );
  L.push("| Status | Findings |");
  L.push("| --- | --- |");
  for (const row of shownStatuses) L.push(`| ${row.label} | ${row.count} |`);
  L.push("");
  L.push("| Threat vector risk band | Vectors |");
  L.push("| --- | --- |");
  for (const row of s.byRiskBand) L.push(`| ${row.label} | ${row.count} |`);
  L.push("");

  // 4. Architecture
  L.push("## 4. Architecture");
  L.push("");
  if (a.architecture.trim()) {
    L.push(demoteHeadings(block(a.architecture), 2));
  } else {
    L.push("_No architecture notes recorded._");
  }
  L.push("");

  // 5. Boundaries
  L.push("## 5. Trust boundaries");
  L.push("");
  if (a.boundaries.length === 0) {
    L.push("_No trust boundaries defined._");
    L.push("");
  } else {
    for (const b of a.boundaries) {
      L.push(`### ${b.id}: ${esc(b.label)}`);
      L.push("");
      L.push(`Type: ${b.typeLabel}.${b.source === "AI" ? " AI-suggested." : ""}`);
      if (b.description.trim()) {
        L.push("");
        L.push(block(b.description));
      }
      L.push("");
      if (b.vectorIds.length === 0) {
        L.push("No threat vectors recorded for this boundary.");
      } else {
        for (const vid of b.vectorIds) {
          const v = a.vectors.find((x) => x.id === vid)!;
          L.push(`- ${v.id}: ${esc(v.title)} (${v.strideLabel}; ${v.mcpCategoryLabel})`);
        }
      }
      L.push("");
    }
  }

  // 6. Vectors
  L.push("## 6. Threat vectors");
  L.push("");
  if (a.vectors.length === 0) {
    L.push("_No threat vectors mapped._");
    L.push("");
  } else {
    L.push("| ID | Threat vector | Boundary | STRIDE | MCP category | Likelihood | Impact | Risk | Residual | Findings | Source |");
    L.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const v of a.vectors) {
      L.push(
        `| ${v.id} | ${cell(v.title)} | ${v.boundaryId} | ${v.strideLabel} | ${v.mcpCategoryLabel} | ` +
          `${v.likelihoodLabel} | ${v.impactLabel} | ${v.riskBand.charAt(0) + v.riskBand.slice(1).toLowerCase()} | ` +
          `${v.residualBand.charAt(0) + v.residualBand.slice(1).toLowerCase()} | ${v.findingIds.join(", ") || "—"} | ` +
          `${v.source === "AI" ? `AI${v.confidence ? ` (${v.confidence.toLowerCase()})` : ""}` : "Manual"} |`,
      );
    }
    L.push("");
  }

  // 7. Register
  const ordered = findingsBySeverity(a.findings);
  L.push("## 7. Findings register");
  L.push("");
  if (ordered.length === 0) {
    L.push("_No findings recorded._");
    L.push("");
  } else {
    L.push("Ordered by severity, then identifier.");
    L.push("");
    L.push("| ID | Severity | Status | Finding | Threat vector | Owner | Due |");
    L.push("| --- | --- | --- | --- | --- | --- | --- |");
    for (const f of ordered) {
      L.push(
        `| ${f.id} | ${f.severityLabel} | ${f.statusLabel} | ${cell(f.title)} | ${f.vectorId ?? "—"} | ${cell(f.owner)} | ${date(f.dueDate)} |`,
      );
    }
    L.push("");
    L.push("## 8. Finding details");
    L.push("");
    for (const f of ordered) {
      L.push(...findingDetail(f, a));
    }
  }
  if (ordered.length === 0) {
    L.push("## 8. Finding details");
    L.push("");
    L.push("_No findings recorded._");
    L.push("");
  }

  // 9. Frameworks
  L.push("## 9. Framework mapping");
  L.push("");
  L.push(a.frameworks.note);
  L.push("");
  if (a.frameworks.owasp.length === 0 && a.frameworks.atlas.length === 0) {
    L.push("_No threat vectors to map._");
    L.push("");
  } else {
    L.push("| Framework | Reference | Name | Threat vectors |");
    L.push("| --- | --- | --- | --- |");
    for (const i of a.frameworks.owasp) {
      const ids = a.vectors.filter((v) => v.frameworks.owasp.includes(i.id)).map((v) => v.id);
      L.push(`| OWASP Top 10 for LLM Applications (2025) | ${i.id} | ${i.name} | ${ids.join(", ")} |`);
    }
    for (const i of a.frameworks.atlas) {
      const ids = a.vectors.filter((v) => v.frameworks.atlas.includes(i.id)).map((v) => v.id);
      L.push(`| MITRE ATLAS | ${i.id} | ${i.name} | ${ids.join(", ")} |`);
    }
    L.push("");
  }

  // 10. Controls
  L.push("## 10. Recommended controls");
  L.push("");
  if (a.controls.length === 0) {
    L.push("_No MCP categories in use._");
    L.push("");
  } else {
    L.push("General guidance for each MCP category present in the model. It is not specific to any one finding.");
    L.push("");
    for (const c of a.controls) {
      L.push(`### ${c.title}`);
      L.push("");
      for (const m of c.mitigations) L.push(`- ${esc(m)}`);
      L.push("");
    }
  }

  // 11. Definitions
  L.push("## 11. Definitions");
  L.push("");
  for (const d of a.definitions) L.push(`- **${d.term}.** ${d.text}`);
  L.push("");

  return L.join("\n");
}
