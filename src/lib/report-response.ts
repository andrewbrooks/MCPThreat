import { NextResponse } from "next/server";
import type { Assessment } from "@/lib/assessment";
import { generateCsv } from "@/lib/report-csv";
import { generateHtml } from "@/lib/report-html";
import { generateReport } from "@/lib/report-markdown";

export const REPORT_FORMATS = {
  md: { ext: "md", type: "text/markdown; charset=utf-8" },
  html: { ext: "html", type: "text/html; charset=utf-8" },
  json: { ext: "json", type: "application/json; charset=utf-8" },
  csv: { ext: "csv", type: "text/csv; charset=utf-8" },
} as const;
export type ReportFormat = keyof typeof REPORT_FORMATS;

export function isReportFormat(s: string): s is ReportFormat {
  return Object.prototype.hasOwnProperty.call(REPORT_FORMATS, s);
}

export function fileSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "project"
  );
}

export function renderReportBody(a: Assessment, format: ReportFormat): string {
  switch (format) {
    case "html":
      return generateHtml(a);
    case "json":
      return JSON.stringify(a, null, 2);
    case "csv":
      return generateCsv(a);
    default:
      return generateReport(a);
  }
}

/** Same headers as the live report route. `filenameBase` is e.g. "slug-threat-model-v3-2026-11-14". */
export function reportResponse(
  a: Assessment,
  format: ReportFormat,
  download: boolean,
  filenameBase: string,
): NextResponse {
  const headers: Record<string, string> = {
    "Content-Type": REPORT_FORMATS[format].type,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  };
  if (format === "html") {
    headers["Content-Security-Policy"] =
      "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'";
  }
  if (download) {
    headers["Content-Disposition"] =
      `attachment; filename="${filenameBase}.${REPORT_FORMATS[format].ext}"`;
  }
  return new NextResponse(renderReportBody(a, format), { headers });
}
