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
import { day as date, fmtBytes, utc } from "@/lib/report-format";
import { RISK_BAND_LABELS } from "@/lib/risk";
import { PARTY_SIDE_LABELS, type PartySide } from "@/lib/taxonomy";

// Self-contained HTML rendering of an Assessment: one file, no scripts, no external
// requests. It is written to be read on screen and printed to PDF from any browser.
// Every value is escaped; severity and status are always shown as text, never by
// colour alone.

export function escapeHtml(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
const h = escapeHtml;

function txt(s: string | null | undefined): string {
  return s && s.trim() ? h(s.trim()) : "—";
}
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function inline(s: string): string {
  return h(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:]|$)/g, "$1<em>$2</em>");
}

/** Small markdown subset: headings, tables, lists, blockquotes, paragraphs, fenced code. */
export function markdownToHtml(md: string, headingBase = 2): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  const splitRow = (l: string) =>
    l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (/^\s*```/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code>${h(buf.join("\n"))}</code></pre>`);
      continue;
    }
    const hm = /^(#{1,6})\s+(.*)$/.exec(line);
    if (hm) {
      const lvl = Math.min(6, hm[1].length + headingBase);
      out.push(`<h${lvl}>${inline(hm[2])}</h${lvl}>`);
      i++;
      continue;
    }
    if (line.trim().startsWith("|") && /^\s*\|?\s*:?-+:?\s*(\||$)/.test(lines[i + 1] ?? "")) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(splitRow(lines[i++]));
      out.push(
        `<table><thead><tr>${head.map((c) => `<th scope="col">${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`,
      );
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i++].replace(/^\s*[-*]\s+/, ""));
      }
      out.push(`<ul>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</ul>`);
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ""));
      out.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`);
      continue;
    }
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6}\s|\s*[-*]\s+|\s*>|\s*```|\s*\|)/.test(lines[i])
    ) {
      buf.push(lines[i++]);
    }
    if (buf.length === 0) {
      buf.push(lines[i++]);
    }
    out.push(`<p>${inline(buf.join(" "))}</p>`);
  }
  return out.join("\n");
}

function paragraphs(s: string): string {
  const t = s.trim();
  if (!t) return '<p class="muted">Not recorded.</p>';
  return t
    .split(/\n{2,}/)
    .map((p) => `<p>${h(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/**
 * The report stylesheet. Every rule is scoped under .report-doc so the same document can
 * be embedded in the app (the Live report page) and served standalone (the HTML export)
 * without leaking styles. It is deliberately fixed to a light "paper" palette: it is a
 * document, not part of the app theme, so it looks the same on screen, in print and in
 * the downloaded file.
 */
export const REPORT_CSS = `
.report-doc { color-scheme: light; background: #fff; color: #1a1f2b; padding: 44px 48px 56px; overflow-x: auto; font: 14.5px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; overflow-wrap: break-word; }
.report-doc *, .report-doc *::before, .report-doc *::after { box-sizing: border-box; }
.report-doc header { padding-bottom: 18px; border-bottom: 3px solid #1a1f2b; margin-bottom: 4px; }
.report-doc header > p:first-child { margin: 0 0 8px; text-transform: uppercase; letter-spacing: .09em; font-size: 12px; font-weight: 600; color: #4a5262; }
.report-doc h1 { font-size: 28px; margin: 0 0 8px; line-height: 1.2; font-weight: 700; letter-spacing: -.01em; }
.report-doc h2 { font-size: 18px; margin: 38px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #98a2b3; line-height: 1.3; font-weight: 700; break-after: avoid; }
.report-doc h3 { font-size: 15px; margin: 24px 0 8px; font-weight: 700; break-after: avoid; }
.report-doc h4 { font-size: 14.5px; margin: 18px 0 6px; font-weight: 700; break-after: avoid; }
.report-doc h5, .report-doc h6 { font-size: 14px; margin: 14px 0 6px; font-weight: 700; }
.report-doc p { margin: 8px 0; }
.report-doc ul, .report-doc ol { margin: 8px 0; padding-left: 22px; }
.report-doc li { margin: 3px 0; }
.report-doc a { color: #0b4fb3; text-decoration: underline; text-underline-offset: 2px; }
.report-doc .muted { color: #4a5262; }
.report-doc .small { font-size: 13px; }
.report-doc table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 13px; }
.report-doc th, .report-doc td { border: 1px solid #cfd4dc; padding: 6px 9px; text-align: left; vertical-align: top; }
.report-doc th { background: #eef1f5; font-weight: 600; }
.report-doc tr { break-inside: avoid; }
.report-doc table.wide { font-size: 12px; }
.report-doc table.wide th, .report-doc table.wide td { padding: 5px 6px; }
.report-doc .scroll { overflow-x: auto; margin: 12px 0; }
.report-doc .scroll table { margin: 0; }
.report-doc code { font: 12.5px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: #eef0f4; padding: 1px 4px; border-radius: 3px; }
.report-doc pre { background: #eef0f4; padding: 10px; overflow-x: auto; border-radius: 4px; }
.report-doc pre code { background: none; padding: 0; }
.report-doc blockquote { margin: 8px 0; padding: 4px 12px; border-left: 3px solid #cfd4dc; color: #4a5262; }
.report-doc .notice { border: 1px solid #b7791f; border-left-width: 4px; background: #fffaf0; padding: 12px 16px; border-radius: 3px; margin: 14px 0; }
.report-doc .notice h3 { margin-top: 0; }
.report-doc .alert { border: 2px solid #b42318; background: #fef3f2; padding: 12px 16px; border-radius: 3px; margin: 14px 0; }
.report-doc .draft { border: 1px solid #9aa4b2; border-left: 4px solid #4a5262; background: #f4f6f9; padding: 10px 14px; border-radius: 3px; margin: 14px 0; font-size: 13.5px; }
.report-doc .hash { font: 12.5px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; overflow-wrap: anywhere; }
.report-doc .kv th { width: 220px; }
.report-doc .tag { display: inline-block; border: 1px solid #5b6577; border-radius: 3px; padding: 0 7px; font-size: 12px; font-weight: 600; white-space: nowrap; line-height: 1.5; }
.report-doc .sev-critical { border-color: #9b1c1c; color: #9b1c1c; }
.report-doc .sev-high { border-color: #b43c00; color: #b43c00; }
.report-doc .sev-medium { border-color: #8a5a00; color: #8a5a00; }
.report-doc .sev-low, .report-doc .sev-info { border-color: #1d4f91; color: #1d4f91; }
.report-doc .finding { break-inside: avoid-page; border: 1px solid #cfd4dc; border-radius: 3px; padding: 4px 18px 14px; margin: 16px 0; }
.report-doc .finding h3 { margin-bottom: 4px; }
.report-doc nav ol { columns: 2; padding-left: 22px; margin: 8px 0; }
.report-doc nav li { margin: 0; padding: 3px 0; break-inside: avoid; }
.report-doc .scroll td:first-child, .report-doc td a[href^="#"] { white-space: nowrap; }
.report-doc dt { margin-top: 10px; }
.report-doc dd { margin: 2px 0 0; }
.report-doc footer { margin-top: 48px; padding-top: 12px; border-top: 1px solid #cfd4dc; font-size: 12.5px; color: #4a5262; }
@page { size: A4; margin: 18mm 16mm 20mm; @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 9pt; color: #4a5262; } }
@media print {
  .report-doc { padding: 0; font-size: 11pt; overflow: visible; }
  .report-doc a { color: inherit; text-decoration: none; }
  .report-doc .scroll { overflow: visible; }
}
@media (max-width: 640px) {
  .report-doc { padding: 22px 16px 40px; }
  .report-doc nav ol { columns: 1; }
  .report-doc .kv th { width: 120px; }
}
`;

function sevTag(f: { severity: string; severityLabel: string }): string {
  return `<span class="tag sev-${slug(f.severity)}">${h(f.severityLabel)}</span>`;
}

function acceptanceHtml(a: AssessmentAcceptance): string {
  const rows: string[] = [
    `<tr><th scope="row">Request</th><td>${h(a.status.charAt(0) + a.status.slice(1).toLowerCase())}, requested by ${txt(a.requestedBy)} on ${date(a.requestedAt)}</td></tr>`,
  ];
  if (a.justification) rows.push(`<tr><th scope="row">Justification</th><td>${txt(a.justification)}</td></tr>`);
  if (a.residualRisk) rows.push(`<tr><th scope="row">Residual risk accepted</th><td>${txt(a.residualRisk)}</td></tr>`);
  for (const ap of a.approvals) {
    rows.push(
      `<tr><th scope="row">${h(PARTY_SIDE_LABELS[ap.side as PartySide] ?? ap.side)} approval</th><td>${txt(ap.by)} on ${date(ap.at)}</td></tr>`,
    );
  }
  if (a.rejection) rows.push(`<tr><th scope="row">Rejected by</th><td>${txt(a.rejection.by)}. ${txt(a.rejection.reason)}</td></tr>`);
  if (a.expiresAt) rows.push(`<tr><th scope="row">Expires</th><td>${date(a.expiresAt)}</td></tr>`);
  return `<table class="kv"><tbody>${rows.join("")}</tbody></table>`;
}

function findingHtml(f: AssessmentFinding): string {
  const fw = [...f.frameworks.owasp, ...f.frameworks.atlas];
  const meta: [string, string][] = [
    ["Severity", sevTag(f)],
    ["Status", h(f.statusLabel)],
    [
      "Threat vector",
      f.vectorId
        ? `<a href="#${h(f.vectorId)}">${h(f.vectorId)}</a> ${h(f.vectorTitle)}${f.mcpCategoryLabel ? ` (${h(f.mcpCategoryLabel)})` : ""}`
        : "—",
    ],
    ["Owner", txt(f.owner)],
    ["Due", date(f.dueDate)],
  ];
  if (f.reviewDueAt) meta.push(["Review due", date(f.reviewDueAt)]);
  meta.push([
    "Source",
    f.source === "AI"
      ? `AI-suggested${f.confidence ? `, ${h(f.confidence.toLowerCase())} confidence` : ""}`
      : "Entered by a person",
  ]);
  if (fw.length) meta.push(["Framework mapping (indicative)", h(fw.join(", "))]);
  meta.push(["Recorded", `${utc(f.createdAt)}. Last updated ${utc(f.updatedAt)}`]);

  return `<section class="finding" id="${h(f.id)}">
<h3>${h(f.id)}: ${h(f.title)}</h3>
<table class="kv"><tbody>${meta.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join("")}</tbody></table>
<h4>Description and rationale</h4>${paragraphs(f.description)}
<h4>Recommendation</h4>${paragraphs(f.recommendation)}
${f.evidence.trim() ? `<h4>Evidence</h4>${paragraphs(f.evidence)}` : ""}
${
  f.attachments.length
    ? `<h4>Attachments</h4><p class="muted small">File contents are not included in this report.</p><ul>${f.attachments
        .map((x) => `<li>${h(x.filename)} (${h(x.mimeType)}, ${fmtBytes(x.size)})</li>`)
        .join("")}</ul>`
    : ""
}
${f.acceptance ? `<h4>Risk acceptance</h4>${acceptanceHtml(f.acceptance)}` : ""}
</section>`;
}

const SECTIONS: [string, string][] = [
  ["record", "Assessment record"],
  ["scope", "Scope and limitations"],
  ["summary", "Summary"],
  ["architecture", "Architecture"],
  ["boundaries", "Trust boundaries"],
  ["vectors", "Threat vectors"],
  ["register", "Findings register"],
  ["details", "Finding details"],
  ["frameworks", "Framework mapping"],
  ["controls", "Recommended controls"],
  ["definitions", "Definitions"],
];

function snapshotHtml(a: Assessment): string {
  const sn = a.snapshot;
  if (!sn) return "";
  const rows: [string, string][] = [
    ["Snapshot version", String(sn.version)],
    ["Issued by", txt(sn.issuedBy)],
    ["Issued at", utc(sn.issuedAt)],
    ["Note", txt(sn.note)],
    ["Content hash (SHA-256)", `<span class="hash">${h(sn.contentHash)}</span>`],
    ["Review requirement", h(REQUIREMENT_LABELS[sn.requirement] ?? sn.requirement)],
    ["Review status", h(SNAPSHOT_STATUS_LABELS[sn.status] ?? sn.status)],
    ["Integrity check", h(SNAPSHOT_INTEGRITY_TEXT[sn.integrity])],
  ];
  const alert =
    sn.integrity === "FAILED"
      ? `<div class="alert" role="alert"><strong>Integrity check failed.</strong> ${h(SNAPSHOT_INTEGRITY_TEXT.FAILED)}</div>`
      : "";
  const signoffs = sn.signoffs.length
    ? `<h4>Sign-offs</h4><table><thead><tr><th scope="col">Party</th><th scope="col">Decision</th><th scope="col">By</th><th scope="col">At</th><th scope="col">Comment</th></tr></thead><tbody>${sn.signoffs
        .map(
          (so) =>
            `<tr><td>${h(PARTY_SIDE_LABELS[so.side as PartySide] ?? so.side)}</td><td>${so.decision === "APPROVED" ? "Approved" : "Returned for changes"}</td><td>${txt(so.by)}</td><td>${utc(so.at)}</td><td>${txt(so.comment)}</td></tr>`,
        )
        .join("")}</tbody></table>`
    : '<p class="muted">No sign-offs have been recorded for this snapshot.</p>';
  return `<h3>Snapshot record</h3>${alert}<table class="kv"><tbody>${rows
    .map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`)
    .join("")}</tbody></table>${signoffs}`;
}

/** The report as an HTML fragment (no <html>/<body>), for embedding under a .report-doc element. */
export function reportBodyHtml(a: Assessment): string {
  const r = a.record;
  const s = a.summary;
  const ordered = findingsBySeverity(a.findings);
  const num = (key: string) => SECTIONS.findIndex(([k]) => k === key) + 1;
  const sec = (key: string) => `<h2 id="${key}">${num(key)}. ${h(SECTIONS[num(key) - 1][1])}</h2>`;

  const record: [string, string][] = [
    ["Project", txt(r.projectName)],
    ["Project status", h(r.projectStatusLabel)],
  ];
  if (r.projectDescription) record.push(["Description", txt(r.projectDescription)]);
  record.push(["MCP server", txt(r.mcpServerUrl)]);
  record.push([
    "Model source",
    r.source.type === "GITHUB"
      ? "Imported from GitHub, then reviewed in MCPThreat"
      : "Entered manually in MCPThreat",
  ]);
  if (r.source.type === "GITHUB") {
    record.push(["Repository", txt(r.source.repoUrl)]);
    record.push([
      "Repository ref",
      r.source.repoRef ? txt(r.source.repoRef) : "Default branch at import time",
    ]);
    record.push(["Analysis run", utc(r.source.analyzedAt)]);
    record.push(["AI model", "Not recorded (configured per deployment, not stored with the analysis)"]);
  }
  if (r.source.techStack.length) record.push(["Technology", txt(r.source.techStack.join(", "))]);
  record.push(["Model created", utc(r.createdAt)]);
  record.push(["Last change recorded", utc(r.lastUpdatedAt)]);
  record.push(["Report generated", utc(a.generatedAt)]);
  record.push(["Tool and version", `${h(a.tool.name)} ${h(a.tool.version)}`]);
  record.push(["Risk-acceptance policy", h(r.acceptancePolicy.label)]);
  record.push([
    "AI-suggested items",
    `${count(r.aiSuggested.boundaries, "boundary", "boundaries")}, ${count(r.aiSuggested.vectors, "threat vector")}, ${count(r.aiSuggested.findings, "finding")}`,
  ]);
  record.push([
    "Audit trail",
    `${count(r.audit.eventCount, "event")}` +
      (r.audit.firstEventAt ? `, ${utc(r.audit.firstEventAt)} to ${utc(r.audit.lastEventAt)}` : ""),
  ]);

  const statuses = s.byStatus.filter(
    (x) => x.count > 0 || x.status !== "PENDING_ACCEPTANCE" || r.acceptancePolicy.value !== "OFF",
  );

  const body = `
<header>
<p class="muted small">Threat model report</p>
<h1>${h(r.projectName)}</h1>
<p class="muted">Prepared with ${h(a.tool.name)} ${h(a.tool.version)} on ${utc(a.generatedAt)}. Report format version ${h(a.schemaVersion)}.</p>
</header>
${
  a.snapshot
    ? `<div class="draft" role="note"><strong>Snapshot v${a.snapshot.version}</strong>, ${h(SNAPSHOT_STATUS_LABELS[a.snapshot.status] ?? a.snapshot.status)}. The snapshot record is in section 1.${a.snapshot.integrity === "FAILED" ? " <strong>Integrity check failed.</strong>" : ""}</div>`
    : `<div class="draft" role="note"><strong>${h(LIVE_DRAFT_NOTICE)}</strong></div>`
}
<nav aria-label="Contents"><h2 style="border:0;margin-top:24px">Contents</h2><ol>${SECTIONS.map(
    ([k, t]) => `<li><a href="#${k}">${h(t)}</a></li>`,
  ).join("")}</ol></nav>

${sec("record")}
${snapshotHtml(a)}
<table class="kv"><tbody>${record.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join("")}</tbody></table>
${
  r.people.length
    ? `<h3>People with access</h3><table><thead><tr><th scope="col">Person</th><th scope="col">Role</th><th scope="col">Party</th></tr></thead><tbody>${r.people
        .map(
          (p) =>
            `<tr><td>${h(p.label)}</td><td>${h(p.role)}</td><td>${h(PARTY_SIDE_LABELS[p.side as PartySide] ?? p.side)}</td></tr>`,
        )
        .join("")}</tbody></table>`
    : ""
}

${sec("scope")}
${a.scope.statements.map((t) => `<p>${h(t)}</p>`).join("")}
<div class="notice" role="note"><h3>Limitations. Please read before relying on this report.</h3><ul>${a.scope.limitations
    .map((t) => `<li>${h(t)}</li>`)
    .join("")}</ul></div>

${sec("summary")}
<p>${h(r.projectName)} has ${count(s.boundaryCount, "trust boundary", "trust boundaries")}, ${count(s.vectorCount, "threat vector")}, and ${count(s.findingCount, "finding")}, of which ${s.openCount} ${s.openCount === 1 ? "is" : "are"} open. Mitigation completion is ${s.completionPct}%. Definitions of &ldquo;open&rdquo; and &ldquo;completion&rdquo; are in section ${num("definitions")}.</p>
<table><thead><tr><th scope="col">Severity</th><th scope="col">Total</th><th scope="col">Open</th></tr></thead><tbody>${s.bySeverity
    .map((x) => `<tr><td>${h(x.label)}</td><td>${x.total}</td><td>${x.open}</td></tr>`)
    .join("")}</tbody></table>
<table><thead><tr><th scope="col">Status</th><th scope="col">Findings</th></tr></thead><tbody>${statuses
    .map((x) => `<tr><td>${h(x.label)}</td><td>${x.count}</td></tr>`)
    .join("")}</tbody></table>
<table><thead><tr><th scope="col">Threat vector risk band</th><th scope="col">Vectors</th></tr></thead><tbody>${s.byRiskBand
    .map((x) => `<tr><td>${h(x.label)}</td><td>${x.count}</td></tr>`)
    .join("")}</tbody></table>

${sec("architecture")}
${a.architecture.trim() ? markdownToHtml(a.architecture, 2) : '<p class="muted">No architecture notes recorded.</p>'}

${sec("boundaries")}
${
  a.boundaries.length === 0
    ? '<p class="muted">No trust boundaries defined.</p>'
    : a.boundaries
        .map(
          (b) => `<h3 id="${h(b.id)}">${h(b.id)}: ${h(b.label)}</h3>
<p class="muted">Type: ${h(b.typeLabel)}.${b.source === "AI" ? " AI-suggested." : ""}</p>
${b.description.trim() ? paragraphs(b.description) : ""}
${
  b.vectorIds.length
    ? `<ul>${b.vectorIds
        .map((vid) => {
          const v = a.vectors.find((x) => x.id === vid)!;
          return `<li><a href="#${h(v.id)}">${h(v.id)}</a>: ${h(v.title)} (${h(v.strideLabel)}; ${h(v.mcpCategoryLabel)})</li>`;
        })
        .join("")}</ul>`
    : '<p class="muted">No threat vectors recorded for this boundary.</p>'
}`,
        )
        .join("\n")
}

${sec("vectors")}
${
  a.vectors.length === 0
    ? '<p class="muted">No threat vectors mapped.</p>'
    : `<div class="scroll"><table class="wide"><thead><tr><th scope="col">ID</th><th scope="col">Threat vector</th><th scope="col">Boundary</th><th scope="col">STRIDE</th><th scope="col">MCP category</th><th scope="col">Likelihood</th><th scope="col">Impact</th><th scope="col">Risk</th><th scope="col">Residual</th><th scope="col">Findings</th><th scope="col">Source</th></tr></thead><tbody>${a.vectors
        .map(
          (v) =>
            `<tr id="${h(v.id)}"><td>${h(v.id)}</td><td>${h(v.title)}</td><td>${h(v.boundaryId)}</td><td>${h(v.strideLabel)}</td><td>${h(v.mcpCategoryLabel)}</td><td>${h(v.likelihoodLabel)}</td><td>${h(v.impactLabel)}</td><td>${h(RISK_BAND_LABELS[v.riskBand])}</td><td>${h(RISK_BAND_LABELS[v.residualBand])}</td><td>${v.findingIds.map((id) => `<a href="#${h(id)}">${h(id)}</a>`).join(", ") || "—"}</td><td>${v.source === "AI" ? `AI${v.confidence ? ` (${h(v.confidence.toLowerCase())})` : ""}` : "Manual"}</td></tr>`,
        )
        .join("")}</tbody></table></div>`
}

${sec("register")}
${
  ordered.length === 0
    ? '<p class="muted">No findings recorded.</p>'
    : `<p class="muted small">Ordered by severity, then identifier.</p><table><thead><tr><th scope="col">ID</th><th scope="col">Severity</th><th scope="col">Status</th><th scope="col">Finding</th><th scope="col">Threat vector</th><th scope="col">Owner</th><th scope="col">Due</th></tr></thead><tbody>${ordered
        .map(
          (f) =>
            `<tr><td><a href="#${h(f.id)}">${h(f.id)}</a></td><td>${sevTag(f)}</td><td>${h(f.statusLabel)}</td><td>${h(f.title)}</td><td>${f.vectorId ? `<a href="#${h(f.vectorId)}">${h(f.vectorId)}</a>` : "—"}</td><td>${txt(f.owner)}</td><td>${date(f.dueDate)}</td></tr>`,
        )
        .join("")}</tbody></table>`
}

${sec("details")}
${ordered.length === 0 ? '<p class="muted">No findings recorded.</p>' : ordered.map(findingHtml).join("\n")}

${sec("frameworks")}
<p>${h(a.frameworks.note)}</p>
${
  a.frameworks.owasp.length === 0 && a.frameworks.atlas.length === 0
    ? '<p class="muted">No threat vectors to map.</p>'
    : `<table><thead><tr><th scope="col">Framework</th><th scope="col">Reference</th><th scope="col">Name</th><th scope="col">Threat vectors</th></tr></thead><tbody>${[
        ...a.frameworks.owasp.map((i) => ({ fw: "OWASP Top 10 for LLM Applications (2025)", i, key: "owasp" as const })),
        ...a.frameworks.atlas.map((i) => ({ fw: "MITRE ATLAS", i, key: "atlas" as const })),
      ]
        .map(({ fw, i, key }) => {
          const ids = a.vectors.filter((v) => v.frameworks[key].includes(i.id)).map((v) => v.id);
          return `<tr><td>${h(fw)}</td><td><a href="${h(i.url)}" rel="noopener noreferrer">${h(i.id)}</a></td><td>${h(i.name)}</td><td>${ids.map((id) => `<a href="#${h(id)}">${h(id)}</a>`).join(", ")}</td></tr>`;
        })
        .join("")}</tbody></table>`
}

${sec("controls")}
${
  a.controls.length === 0
    ? '<p class="muted">No MCP categories in use.</p>'
    : `<p class="muted">General guidance for each MCP category present in the model. It is not specific to any one finding.</p>` +
      a.controls
        .map(
          (c) =>
            `<h3>${h(c.title)}</h3><ul>${c.mitigations.map((m) => `<li>${h(m)}</li>`).join("")}</ul>`,
        )
        .join("")
}

${sec("definitions")}
<dl>${a.definitions.map((d) => `<dt><strong>${h(d.term)}</strong></dt><dd>${h(d.text)}</dd>`).join("")}</dl>

<footer>${h(a.tool.name)} ${h(a.tool.version)} &middot; generated ${utc(a.generatedAt)} &middot; report format ${h(a.schemaVersion)}. This document is a record of a threat model, not a certification.</footer>
`;

  return body;
}

/** The standalone HTML export: one file, no scripts, no external requests. */
export function generateHtml(a: Assessment): string {
  const r = a.record;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="${h(a.tool.name)} ${h(a.tool.version)}">
<title>Threat Model Report: ${h(r.projectName)}</title>
<style>${REPORT_CSS}
body { margin: 0; background: #e9ecf1; }
main.report-doc { max-width: 960px; margin: 0 auto; }
@media print { body { background: #fff; } main.report-doc { max-width: none; } }
</style>
</head>
<body>
<main class="report-doc">${reportBodyHtml(a)}</main>
</body>
</html>
`;
}
