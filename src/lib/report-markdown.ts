import {
  count,
  findingsBySeverity,
  type Assessment,
  type AssessmentAcceptance,
  type AssessmentFinding,
  LIVE_DRAFT_NOTICE,
  REQUIREMENT_LABELS,
  SNAPSHOT_INTEGRITY_TEXT,
  SNAPSHOT_STATUS_LABELS,
} from "@/lib/assessment";
import { day as date, fmtBytes, NOT_RECORDED as DASH, utc } from "@/lib/report-format";
import { executiveSummary, preparedBy, statusLine } from "@/lib/report-summary";
import { RISK_BAND_LABELS } from "@/lib/risk";
import { PARTY_SIDE_LABELS, type PartySide } from "@/lib/taxonomy";

// Markdown rendering of an Assessment. The same data feeds the HTML, CSV and JSON
// exports (see report-html.ts, report-csv.ts), so wording lives in assessment.ts.

/** Escape characters that would otherwise be read as markup or break a table row. */
function esc(s: string): string {
  return s.replace(/</g, "\\<");
}
function cell(s: string | null | undefined): string {
  const v = (s ?? "").trim();
  if (!v) return "—";
  return esc(v)
    .replace(/\|/g, "\\|")
    .replace(/\r?\n+/g, " ");
}
function block(s: string): string {
  return esc(s.trim());
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
  out.push(
    `- **Acceptance request:** ${a.status.charAt(0) + a.status.slice(1).toLowerCase()}, requested by ${cell(a.requestedBy)} on ${date(a.requestedAt)}`,
  );
  if (a.justification) out.push(`- **Justification:** ${cell(a.justification)}`);
  if (a.residualRisk) out.push(`- **Residual risk accepted:** ${cell(a.residualRisk)}`);
  for (const ap of a.approvals) {
    out.push(
      `- **${PARTY_SIDE_LABELS[ap.side as PartySide] ?? ap.side} approval:** ${cell(ap.by)} on ${date(ap.at)}`,
    );
  }
  if (a.rejection)
    out.push(`- **Rejected by:** ${cell(a.rejection.by)}. ${cell(a.rejection.reason)}`);
  if (a.expiresAt) out.push(`- **Acceptance expires:** ${date(a.expiresAt)}`);
  return out;
}

function findingDetail(f: AssessmentFinding): string[] {
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
  return lines;
}

function coverLines(a: Assessment): string[] {
  const r = a.record;
  const sn = a.snapshot;
  const L: string[] = [];
  L.push(`# ${esc(r.projectName)}`);
  L.push("");
  L.push("**Threat model report**");
  L.push("");
  if (r.mcpServerUrl) {
    L.push(`MCP server: ${esc(r.mcpServerUrl)}`);
    L.push("");
  }
  L.push(`**${statusLine(a)}**`);
  L.push("");
  if (sn?.integrity === "FAILED") {
    L.push(`> **Integrity check failed.** ${SNAPSHOT_INTEGRITY_TEXT.FAILED}`);
    L.push("");
  }
  L.push("### Document control");
  L.push("");
  L.push("| Item | Value |");
  L.push("| --- | --- |");
  L.push(`| Version | ${sn ? `Snapshot v${sn.version}` : "Live draft (not a numbered version)"} |`);
  L.push(`| ${sn ? "Date issued" : "Date generated"} | ${utc(sn ? sn.issuedAt : a.generatedAt)} |`);
  if (sn) L.push(`| Report generated | ${utc(a.generatedAt)} |`);
  L.push(`| Report format version | ${a.schemaVersion} |`);
  L.push(`| Tool and version | ${a.tool.name} ${a.tool.version} |`);
  L.push(`| Risk-acceptance policy | ${r.acceptancePolicy.label} |`);
  if (sn) {
    L.push(`| Content hash (SHA-256) | \`${sn.contentHash}\` |`);
    if (sn.note.trim()) L.push(`| Snapshot note | ${cell(sn.note)} |`);
    L.push(`| Integrity check | ${SNAPSHOT_INTEGRITY_TEXT[sn.integrity]} |`);
  }
  L.push("");
  L.push("### Review and sign-off");
  L.push("");
  L.push("| Item | Value |");
  L.push("| --- | --- |");
  L.push(`| Prepared by | ${cell(preparedBy(a))} |`);
  if (sn) {
    L.push(`| Review requirement | ${REQUIREMENT_LABELS[sn.requirement] ?? sn.requirement} |`);
    L.push(`| Review status | ${SNAPSHOT_STATUS_LABELS[sn.status] ?? sn.status} |`);
  } else {
    L.push("| Review status | Not reviewed. This is a live draft. |");
  }
  L.push("");
  if (sn) {
    if (sn.signoffs.length) {
      L.push("| Party | Decision | Name | Date | Comment | Signature |");
      L.push("| --- | --- | --- | --- | --- | --- |");
      for (const so of sn.signoffs) {
        L.push(
          `| ${PARTY_SIDE_LABELS[so.side as PartySide] ?? so.side} | ${so.decision === "APPROVED" ? "Approved" : "Returned for changes"} | ${cell(so.by)} | ${utc(so.at)} | ${cell(so.comment)} |  |`,
        );
      }
    } else {
      L.push("No sign-offs have been recorded for this snapshot.");
    }
  } else {
    L.push(`> ${LIVE_DRAFT_NOTICE}`);
  }
  L.push("");
  return L;
}

function executiveLines(a: Assessment): string[] {
  const x = executiveSummary(a);
  const L: string[] = [];
  L.push("## Executive summary");
  L.push("");
  L.push(esc(x.headline));
  L.push("");
  L.push("### Findings by severity");
  L.push("");
  L.push("| Severity | Total | Open |");
  L.push("| --- | --- | --- |");
  for (const t of x.tiles) L.push(`| ${t.label} | ${t.total} | ${t.open} |`);
  L.push("");
  L.push("### Findings by status");
  L.push("");
  L.push("| Status | Findings | Share |");
  L.push("| --- | --- | --- |");
  for (const t of x.statuses) L.push(`| ${t.label} | ${t.count} | ${Math.round(t.pct)}% |`);
  L.push("");
  L.push("### Threat vector risk matrix");
  L.push("");
  L.push(
    `Threat vectors by likelihood and impact (${x.matrix.vectorCount} in total). Each cell shows the number of threat vectors and the risk band.`,
  );
  L.push("");
  L.push(
    `| Likelihood by impact | ${x.matrix.impactLabels.map((c) => `${c.label} impact`).join(" | ")} |`,
  );
  L.push("| --- | --- | --- | --- |");
  for (const row of x.matrix.rows) {
    L.push(
      `| ${row.likelihoodLabel} likelihood | ${row.cells.map((c) => `${c.count} (${c.bandLabel} risk)`).join(" | ")} |`,
    );
  }
  L.push("");
  L.push("### Open findings requiring attention");
  L.push("");
  if (x.attention.length === 0) {
    L.push("No findings are open.");
  } else {
    L.push("| ID | Severity | Finding | Owner | Due |");
    L.push("| --- | --- | --- | --- | --- |");
    for (const f of x.attention) {
      L.push(
        `| ${f.id} | ${f.severityLabel} | ${cell(f.title)} | ${cell(f.owner)} | ${date(f.dueDate)} |`,
      );
    }
    if (x.attentionTotal > x.attention.length) {
      L.push("");
      L.push(
        `Showing ${x.attention.length} of ${x.attentionTotal} open findings. The full list is in section 7.`,
      );
    }
  }
  L.push("");
  L.push("### Key observations");
  L.push("");
  if (x.observations.length) for (const o of x.observations) L.push(`- ${esc(o)}`);
  else L.push(x.noObservationsText);
  L.push("");
  L.push(x.observationsNote);
  L.push("");
  return L;
}

export function generateReport(a: Assessment): string {
  const r = a.record;
  const s = a.summary;
  const L: string[] = [];

  L.push(...coverLines(a));
  L.push(...executiveLines(a));
  L.push("## Contents");
  L.push("");
  [
    "Executive summary",
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
    L.push(
      `| Repository ref | ${r.source.repoRef ? cell(r.source.repoRef) : "Default branch at import time"} |`,
    );
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
    `| AI-suggested items | ${count(r.aiSuggested.boundaries, "boundary", "boundaries")}, ${count(r.aiSuggested.vectors, "threat vector")}, ${count(r.aiSuggested.findings, "finding")} |`,
  );
  L.push(
    `| Audit trail | ${count(r.audit.eventCount, "event")}` +
      (r.audit.firstEventAt
        ? `, ${utc(r.audit.firstEventAt)} to ${utc(r.audit.lastEventAt)}`
        : "") +
      " |",
  );
  L.push("");
  if (r.people.length) {
    L.push("**People with access**");
    L.push("");
    L.push("| Person | Role | Party |");
    L.push("| --- | --- | --- |");
    for (const p of r.people) {
      L.push(
        `| ${cell(p.label)} | ${p.role} | ${PARTY_SIDE_LABELS[p.side as PartySide] ?? p.side} |`,
      );
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
    `${esc(r.projectName)} has ${count(s.boundaryCount, "trust boundary", "trust boundaries")}, ${count(s.vectorCount, "threat vector")}, and ${count(s.findingCount, "finding")}, of which ${s.openCount} ${s.openCount === 1 ? "is" : "are"} open. ` +
      `Mitigation completion is ${s.completionPct}%. Counts by severity and status are in the executive summary at the start of this report. Definitions of "open" and "completion" are in section 11.`,
  );
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
    L.push(
      "| ID | Threat vector | Boundary | STRIDE | MCP category | Likelihood | Impact | Risk | Residual | Findings | Source |",
    );
    L.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const v of a.vectors) {
      L.push(
        `| ${v.id} | ${cell(v.title)} | ${v.boundaryId} | ${v.strideLabel} | ${v.mcpCategoryLabel} | ` +
          `${v.likelihoodLabel} | ${v.impactLabel} | ${RISK_BAND_LABELS[v.riskBand]} | ` +
          `${RISK_BAND_LABELS[v.residualBand]} | ${v.findingIds.join(", ") || "—"} | ` +
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
      L.push(...findingDetail(f));
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
      L.push(
        `| OWASP Top 10 for LLM Applications (2025) | ${i.id} | ${i.name} | ${ids.join(", ")} |`,
      );
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
    L.push(
      "General guidance for each MCP category present in the model. It is not specific to any one finding.",
    );
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
