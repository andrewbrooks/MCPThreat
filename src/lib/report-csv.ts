import { findingsBySeverity, type Assessment } from "@/lib/assessment";

// CSV export of the findings register, one row per finding. Values that a spreadsheet
// could interpret as a formula are prefixed with an apostrophe so opening the file
// cannot execute anything.

const COLUMNS = [
  "Finding ID",
  "Severity",
  "Status",
  "Title",
  "Threat vector ID",
  "Threat vector",
  "MCP category",
  "Owner",
  "Due date",
  "Review due",
  "Source",
  "AI confidence",
  "OWASP LLM (indicative)",
  "MITRE ATLAS (indicative)",
  "Description",
  "Recommendation",
  "Evidence",
  "Acceptance status",
  "Recorded (UTC)",
  "Last updated (UTC)",
  "Internal uid",
] as const;

/** One CSV cell, quoted when needed. A leading =, +, -, @, tab or carriage return gets an apostrophe prefix so a spreadsheet does not run the text as a formula. */
export function csvField(value: string | null | undefined): string {
  let v = value ?? "";
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** The findings as CSV, one row per finding, most severe first. */
export function generateCsv(a: Assessment): string {
  const rows = findingsBySeverity(a.findings).map((f) =>
    [
      f.id,
      f.severityLabel,
      f.statusLabel,
      f.title,
      f.vectorId,
      f.vectorTitle,
      f.mcpCategoryLabel,
      f.owner,
      f.dueDate,
      f.reviewDueAt,
      f.source === "AI" ? "AI-suggested" : "Entered by a person",
      f.confidence,
      f.frameworks.owasp.join("; "),
      f.frameworks.atlas.join("; "),
      f.description,
      f.recommendation,
      f.evidence,
      f.acceptance ? f.acceptance.status : "",
      f.createdAt,
      f.updatedAt,
      f.uid,
    ]
      .map((c) => csvField(c))
      .join(","),
  );
  // CRLF line endings and a BOM so Excel reads UTF-8 correctly.
  return "﻿" + [COLUMNS.join(","), ...rows].join("\r\n") + "\r\n";
}
