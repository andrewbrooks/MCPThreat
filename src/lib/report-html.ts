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
import { executiveSummary, preparedBy, statusLine, type ExecutiveSummary } from "@/lib/report-summary";
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
.report-doc .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
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
.report-doc .cover { padding: 28px 0 36px; border-bottom: 1px solid #98a2b3; margin-bottom: 8px; }
.report-doc .cover-kicker { margin: 0 0 14px; text-transform: uppercase; letter-spacing: .14em; font-size: 12.5px; font-weight: 700; color: #4a5262; }
.report-doc .cover h1 { font-size: 40px; line-height: 1.12; letter-spacing: -.02em; margin: 0; padding: 0 0 18px; border-bottom: 4px solid #1a1f2b; }
.report-doc .cover-url { margin: 14px 0 0; font-size: 15px; color: #2b3342; }
.report-doc .cover-status { margin: 18px 0 4px; font-size: 16px; font-weight: 700; }
.report-doc .cover h2 { font-size: 12.5px; text-transform: uppercase; letter-spacing: .1em; color: #4a5262; border: 0; margin: 30px 0 4px; padding: 0; }
.report-doc .cover table { margin: 6px 0 0; }
.report-doc .cover .kv th { width: 210px; }
.report-doc .cover td.sig { min-width: 150px; height: 44px; }
.report-doc .exec { margin-top: 8px; }
.report-doc .exec h2.front { margin-top: 32px; }
.report-doc .exec h3 { font-size: 14px; margin: 22px 0 6px; }
.report-doc .headline { font-size: 17px; line-height: 1.45; margin: 4px 0 14px; font-weight: 600; }
.report-doc .tiles { list-style: none; margin: 10px 0 0; padding: 0; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
.report-doc .tiles li { margin: 0; border: 1px solid #98a2b3; border-top-width: 4px; border-radius: 3px; padding: 8px 10px; break-inside: avoid; }
.report-doc .tiles .t-label { display: block; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
.report-doc .tiles .t-total { display: block; font-size: 28px; font-weight: 700; line-height: 1.15; }
.report-doc .tiles .t-open { display: block; font-size: 12.5px; color: #2b3342; }
.report-doc .tiles .sev-critical { border-top-color: #9b1c1c; }
.report-doc .tiles .sev-high { border-top-color: #b43c00; }
.report-doc .tiles .sev-medium { border-top-color: #8a5a00; }
.report-doc .tiles .sev-low, .report-doc .tiles .sev-info { border-top-color: #1d4f91; }
.report-doc .tiles .sev-info { border-top-style: dashed; }
.report-doc .bar { display: flex; height: 30px; border: 1px solid #1a1f2b; border-radius: 2px; overflow: hidden; margin: 8px 0 8px; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
.report-doc .bar-empty { height: auto; padding: 5px 8px; font-size: 13px; }
.report-doc .bar > span { display: flex; align-items: center; justify-content: center; overflow: hidden; border-right: 1px solid #1a1f2b; min-width: 3px; }
.report-doc .bar > span:last-child { border-right: 0; }
.report-doc .bar b { background: #fff; color: #1a1f2b; font-size: 12px; line-height: 1.3; padding: 0 5px; border: 1px solid #1a1f2b; border-radius: 2px; }
.report-doc .st-open { background: #1a1f2b; }
.report-doc .st-in_progress { background: repeating-linear-gradient(45deg, #5b6577 0 4px, #fff 4px 8px); }
.report-doc .st-pending_acceptance { background: radial-gradient(#1a1f2b 1.4px, #fff 1.6px) 0 0 / 7px 7px; }
.report-doc .st-mitigated { background: repeating-linear-gradient(0deg, #98a2b3 0 3px, #fff 3px 6px); }
.report-doc .st-accepted { background: repeating-linear-gradient(135deg, #cfd4dc 0 3px, #fff 3px 6px, #5b6577 6px 7px, #fff 7px 10px); }
.report-doc .st-closed { background: #fff; }
.report-doc .legend { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 20px; font-size: 13px; }
.report-doc .legend li { margin: 0; display: flex; align-items: center; gap: 6px; }
.report-doc .legend i { display: inline-block; width: 22px; height: 14px; border: 1px solid #1a1f2b; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
.report-doc table.matrix { width: auto; max-width: 100%; table-layout: fixed; margin: 6px 0 0; }
.report-doc table.matrix caption { text-align: left; font-size: 13px; color: #2b3342; padding-bottom: 6px; caption-side: top; }
.report-doc table.matrix th, .report-doc table.matrix td { text-align: center; vertical-align: middle; padding: 6px 8px; width: 120px; }
.report-doc table.matrix thead th:first-child { width: 150px; }
.report-doc table.matrix tbody th { text-align: left; }
.report-doc table.matrix td { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
.report-doc table.matrix .n { display: block; font-size: 20px; font-weight: 700; line-height: 1.2; }
.report-doc table.matrix .b { display: block; font-size: 12px; }
.report-doc table.matrix .band-low { background: #eef3fa; }
.report-doc table.matrix .band-medium { background: #fdf3dc; }
.report-doc table.matrix .band-high { background: #fbe3d3; border: 2px solid #8a3b00; }
.report-doc table.matrix .band-critical { background: #f6caca; border: 3px double #7a1212; }
.report-doc table.attn td:nth-child(3) { min-width: 200px; }
.report-doc .observations li { margin: 4px 0; }
.report-doc .toc { list-style: none; columns: 2; padding-left: 0; margin: 8px 0; }
.report-doc .toc li { margin: 0; padding: 3px 0; break-inside: avoid; }
.report-doc .scroll td:first-child, .report-doc td a[href^="#"] { white-space: nowrap; }
.report-doc dt { margin-top: 10px; }
.report-doc dd { margin: 2px 0 0; }
.report-doc footer { margin-top: 48px; padding-top: 12px; border-top: 1px solid #cfd4dc; font-size: 12.5px; color: #4a5262; }
@page { size: A4; margin: 18mm 16mm 20mm; @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 9pt; color: #4a5262; } }
@media print {
  .report-doc { padding: 0; font-size: 11pt; overflow: visible; }
  .report-doc .cover { break-after: page; border-bottom: 0; padding: 6mm 0 0; margin: 0; font-size: 10pt; }
  .report-doc .cover h1 { font-size: 30pt; padding-bottom: 12px; }
  .report-doc .cover h2 { margin-top: 18px; }
  .report-doc .cover th, .report-doc .cover td { padding: 4px 8px; }
  .report-doc .cover td.sig { height: 34px; }
  .report-doc .cover table, .report-doc .cover .scroll { break-inside: avoid; }
  .report-doc .exec { break-after: page; margin: 0; font-size: 10pt; }
  .report-doc .exec h2.front { margin-top: 0; font-size: 16pt; }
  .report-doc .exec h3 { margin: 10px 0 3px; font-size: 10.5pt; }
  .report-doc .exec .headline { font-size: 12pt; margin: 2px 0 6px; }
  .report-doc .exec .tiles { gap: 6px; margin-top: 4px; }
  .report-doc .exec .tiles li { padding: 4px 8px; }
  .report-doc .exec .tiles .t-total { font-size: 20px; line-height: 1.1; }
  .report-doc .exec .bar { height: 22px; margin: 4px 0; }
  .report-doc .exec table.matrix th, .report-doc .exec table.matrix td { padding: 3px 6px; width: 100px; }
  .report-doc .exec table.matrix .n { font-size: 15px; line-height: 1.1; }
  .report-doc .exec table.matrix caption { padding-bottom: 3px; }
  .report-doc .exec th, .report-doc .exec td { padding: 3px 7px; }
  .report-doc .exec p { margin: 4px 0; }
  .report-doc .exec li { margin: 2px 0; }
  .report-doc .exec table { margin: 4px 0; font-size: 9.5pt; }
  .report-doc .exec li, .report-doc .exec table, .report-doc .tiles, .report-doc .bar, .report-doc .legend { break-inside: avoid; }
  .report-doc a { color: inherit; text-decoration: none; }
  .report-doc .scroll { overflow: visible; }
}
@media (max-width: 640px) {
  .report-doc { padding: 22px 16px 40px; }
  .report-doc .toc { columns: 1; }
  .report-doc .kv th { width: 120px; }
  .report-doc .cover { padding-top: 8px; }
  .report-doc .cover h1 { font-size: 30px; }
  .report-doc .cover .kv th { width: 120px; }
  .report-doc .tiles { grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); }
  .report-doc table.matrix th, .report-doc table.matrix td { width: auto; padding: 4px; }
  .report-doc table.matrix thead th:first-child { width: 84px; }
  .report-doc table.matrix .n { font-size: 17px; }
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

function kvTable(rows: [string, string][], cls = "kv"): string {
  return `<table class="${cls}"><tbody>${rows.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join("")}</tbody></table>`;
}

function signoffTable(a: Assessment): string {
  const sn = a.snapshot;
  if (!sn) return "";
  if (sn.signoffs.length === 0) return '<p class="muted">No sign-offs have been recorded for this snapshot.</p>';
  return `<div class="scroll"><table><caption class="sr">Sign-offs recorded for this snapshot</caption><thead><tr><th scope="col">Party</th><th scope="col">Decision</th><th scope="col">Name</th><th scope="col">Date</th><th scope="col">Comment</th><th scope="col">Signature</th></tr></thead><tbody>${sn.signoffs
    .map(
      (so) =>
        `<tr><td>${h(PARTY_SIDE_LABELS[so.side as PartySide] ?? so.side)}</td><td>${so.decision === "APPROVED" ? "Approved" : "Returned for changes"}</td><td>${txt(so.by)}</td><td>${utc(so.at)}</td><td>${txt(so.comment)}</td><td class="sig"></td></tr>`,
    )
    .join("")}</tbody></table></div>`;
}

function coverHtml(a: Assessment): string {
  const r = a.record;
  const sn = a.snapshot;
  const control: [string, string][] = [
    ["Version", sn ? `Snapshot v${sn.version}` : "Live draft (not a numbered version)"],
    [sn ? "Date issued" : "Date generated", utc(sn ? sn.issuedAt : a.generatedAt)],
  ];
  if (sn) control.push(["Report generated", utc(a.generatedAt)]);
  control.push(
    ["Report format version", h(a.schemaVersion)],
    ["Tool and version", `${h(a.tool.name)} ${h(a.tool.version)}`],
    ["Risk-acceptance policy", h(r.acceptancePolicy.label)],
  );
  if (sn) {
    control.push(["Content hash (SHA-256)", `<span class="hash">${h(sn.contentHash)}</span>`]);
    if (sn.note.trim()) control.push(["Snapshot note", txt(sn.note)]);
    control.push(["Integrity check", h(SNAPSHOT_INTEGRITY_TEXT[sn.integrity])]);
  }
  const review: [string, string][] = [["Prepared by", txt(preparedBy(a))]];
  if (sn) {
    review.push(["Review requirement", h(REQUIREMENT_LABELS[sn.requirement] ?? sn.requirement)]);
    review.push(["Review status", h(SNAPSHOT_STATUS_LABELS[sn.status] ?? sn.status)]);
  } else {
    review.push(["Review status", "Not reviewed. This is a live draft."]);
  }
  const alert =
    sn?.integrity === "FAILED"
      ? `<div class="alert" role="alert"><strong>Integrity check failed.</strong> ${h(SNAPSHOT_INTEGRITY_TEXT.FAILED)}</div>`
      : "";
  return `<section class="cover" aria-labelledby="report-title">
<p class="cover-kicker">Threat model report</p>
<h1 id="report-title">${h(r.projectName)}</h1>
${r.mcpServerUrl ? `<p class="cover-url">MCP server: ${h(r.mcpServerUrl)}</p>` : ""}
<p class="cover-status">${h(statusLine(a))}</p>
${alert}
<h2>Document control</h2>
${kvTable(control)}
<h2>Review and sign-off</h2>
${kvTable(review)}
${
  sn
    ? signoffTable(a)
    : `<div class="draft" role="note">${h(LIVE_DRAFT_NOTICE)}</div>`
}
</section>`;
}

function sevTileClass(sev: string): string {
  return `sev-${slug(sev)}`;
}

function statusBarHtml(x: ExecutiveSummary): string {
  const segs = x.statuses.filter((t) => t.count > 0);
  const summary = x.statuses.map((t) => `${t.label} ${t.count}`).join(", ");
  const bar = segs.length
    ? `<div class="bar" role="img" aria-label="${h(`Findings by status: ${summary}`)}">${segs
        .map(
          (t) =>
            `<span class="st-${slug(t.status).replace(/-/g, "_")}" style="width:${t.pct.toFixed(2)}%"><b>${t.count}</b></span>`,
        )
        .join("")}</div>`
    : '<div class="bar bar-empty">No findings recorded.</div>';
  const legend = `<ul class="legend">${x.statuses
    .map(
      (t) =>
        `<li><i class="st-${slug(t.status).replace(/-/g, "_")}"></i>${h(t.label)}: <strong>${t.count}</strong></li>`,
    )
    .join("")}</ul>`;
  return bar + legend;
}

function matrixHtml(x: ExecutiveSummary): string {
  const m = x.matrix;
  return `<table class="matrix"><caption>Threat vectors by likelihood and impact (${m.vectorCount} in total). Each cell shows the number of threat vectors and the risk band for that combination.</caption><thead><tr><th scope="col">Likelihood by impact</th>${m.impactLabels
    .map((c) => `<th scope="col">${h(c.label)} impact</th>`)
    .join("")}</tr></thead><tbody>${m.rows
    .map(
      (row) =>
        `<tr><th scope="row">${h(row.likelihoodLabel)} likelihood</th>${row.cells
          .map(
            (c) =>
              `<td class="band-${c.band.toLowerCase()}"><span class="n">${c.count}</span><span class="b">${h(c.bandLabel)} risk</span></td>`,
          )
          .join("")}</tr>`,
    )
    .join("")}</tbody></table>`;
}

function executiveHtml(a: Assessment): string {
  const x = executiveSummary(a);
  const tiles = `<ul class="tiles" aria-label="Findings by severity">${x.tiles
    .map(
      (t) =>
        `<li class="${sevTileClass(t.severity)}"><span class="t-label">${h(t.label)}</span><span class="t-total">${t.total}</span><span class="t-open">${t.open} open</span></li>`,
    )
    .join("")}</ul>`;
  const attention = x.attention.length
    ? `<div class="scroll"><table class="attn"><caption class="sr">Open findings requiring attention</caption><thead><tr><th scope="col">ID</th><th scope="col">Severity</th><th scope="col">Finding</th><th scope="col">Owner</th><th scope="col">Due</th></tr></thead><tbody>${x.attention
        .map(
          (f) =>
            `<tr><td><a href="#${h(f.id)}">${h(f.id)}</a></td><td>${sevTag(f)}</td><td>${h(f.title)}</td><td>${txt(f.owner)}</td><td>${date(f.dueDate)}</td></tr>`,
        )
        .join("")}</tbody></table></div>${
        x.attentionTotal > x.attention.length
          ? `<p class="muted small">Showing ${x.attention.length} of ${x.attentionTotal} open findings. The full list is in section 7.</p>`
          : ""
      }`
    : '<p class="muted">No findings are open.</p>';
  const observations = x.observations.length
    ? `<ul class="observations">${x.observations.map((o) => `<li>${h(o)}</li>`).join("")}</ul>`
    : `<p>${h(x.noObservationsText)}</p>`;
  return `<section class="exec" id="executive-summary" aria-labelledby="executive-summary-h">
<h2 class="front" id="executive-summary-h">Executive summary</h2>
<p class="headline">${h(x.headline)}</p>
<h3>Findings by severity</h3>
${tiles}
<h3>Findings by status</h3>
${statusBarHtml(x)}
<h3>Threat vector risk matrix</h3>
${matrixHtml(x)}
<h3>Open findings requiring attention</h3>
${attention}
<h3>Key observations</h3>
${observations}
<p class="muted small">${h(x.observationsNote)}</p>
</section>`;
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

  const body = `
${coverHtml(a)}
${executiveHtml(a)}
<nav aria-label="Contents"><h2 style="border:0;margin-top:24px">Contents</h2><ol class="toc"><li><a href="#executive-summary">Executive summary</a></li>${SECTIONS.map(
    ([k, t], idx) => `<li><a href="#${k}">${idx + 1}. ${h(t)}</a></li>`,
  ).join("")}</ol></nav>

${sec("record")}
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
<p>${h(r.projectName)} has ${count(s.boundaryCount, "trust boundary", "trust boundaries")}, ${count(s.vectorCount, "threat vector")}, and ${count(s.findingCount, "finding")}, of which ${s.openCount} ${s.openCount === 1 ? "is" : "are"} open. Mitigation completion is ${s.completionPct}%. Counts by severity and status are in the executive summary at the start of this report. Definitions of &ldquo;open&rdquo; and &ldquo;completion&rdquo; are in section ${num("definitions")}.</p>
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
