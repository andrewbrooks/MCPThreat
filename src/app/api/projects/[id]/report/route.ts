import { NextResponse } from "next/server";
import { errorResponse, requireProjectAccess } from "@/lib/authz";
import { currentUserId } from "@/lib/auth";
import { generateCsv } from "@/lib/report-csv";
import { generateHtml } from "@/lib/report-html";
import { loadAssessment } from "@/lib/report-loader";
import { generateReport } from "@/lib/report-markdown";

type Params = { params: { id: string } };

const FORMATS = {
  md: { ext: "md", type: "text/markdown; charset=utf-8" },
  html: { ext: "html", type: "text/html; charset=utf-8" },
  json: { ext: "json", type: "application/json; charset=utf-8" },
  csv: { ext: "csv", type: "text/csv; charset=utf-8" },
} as const;
type Format = keyof typeof FORMATS;

function fileSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
}

// GET /api/projects/:id/report?format=md|html|json|csv[&download=1]
//   md   (default) the threat-model report as Markdown
//   html a self-contained HTML report, suitable for printing to PDF
//   json the full assessment for machine use (schemaVersion in the payload)
//   csv  the findings register, one row per finding
// Earlier versions returned {"markdown": "..."} for ?format=json; that is now the
// assessment object.
export async function GET(req: Request, { params }: Params) {
  try {
    const userId = await currentUserId();
    await requireProjectAccess(userId, params.id);

    const url = new URL(req.url);
    const requested = url.searchParams.get("format") ?? "md";
    if (!(requested in FORMATS)) {
      return NextResponse.json(
        { error: `Unknown format "${requested}". Use one of: md, html, json, csv.` },
        { status: 400 },
      );
    }
    const format = requested as Format;

    const assessment = await loadAssessment(params.id);
    if (!assessment) throw new Error("Project not found after access check.");

    let body: string;
    switch (format) {
      case "html":
        body = generateHtml(assessment);
        break;
      case "json":
        body = JSON.stringify(assessment, null, 2);
        break;
      case "csv":
        body = generateCsv(assessment);
        break;
      default:
        body = generateReport(assessment);
    }

    const headers: Record<string, string> = {
      "Content-Type": FORMATS[format].type,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    };
    if (format === "html") {
      headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'";
    }
    if (url.searchParams.get("download") === "1") {
      const stamp = assessment.generatedAt.slice(0, 10);
      headers["Content-Disposition"] =
        `attachment; filename="${fileSlug(assessment.record.projectName)}-threat-model-${stamp}.${FORMATS[format].ext}"`;
    }
    return new NextResponse(body, { headers });
  } catch (err) {
    return errorResponse(err);
  }
}
