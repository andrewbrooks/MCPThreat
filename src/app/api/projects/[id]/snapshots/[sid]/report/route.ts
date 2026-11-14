import { NextResponse } from "next/server";
import { withSnapshot } from "@/lib/assessment";
import { AuthzError, errorResponse, requireProjectAccess } from "@/lib/authz";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fileSlug, isReportFormat, reportResponse } from "@/lib/report-response";
import { parseStoredAssessment } from "@/lib/snapshot";
import { toSnapshotSummary } from "@/lib/snapshot-loader";

type Params = { params: Promise<{ id: string; sid: string }> };

// GET /api/projects/:id/snapshots/:sid/report?format=md|html|json|csv[&download=1]
export async function GET(req: Request, { params: paramsPromise }: Params) {
  const params = await paramsPromise;
  try {
    const userId = await currentUserId();
    await requireProjectAccess(userId, params.id);

    const url = new URL(req.url);
    const requested = url.searchParams.get("format") ?? "md";
    if (!isReportFormat(requested)) {
      return NextResponse.json(
        { error: `Unknown format "${requested}". Use one of: md, html, json, csv.` },
        { status: 400 },
      );
    }

    const row = await prisma.assessmentSnapshot.findFirst({
      where: { id: params.sid, projectId: params.id },
      include: { signoffs: true },
    });
    if (!row) throw new AuthzError(404, "Snapshot not found.");
    const latest = await prisma.assessmentSnapshot.findFirst({
      where: { projectId: params.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    let parsed;
    try {
      parsed = parseStoredAssessment(row.assessment, row.contentHash);
    } catch {
      return NextResponse.json(
        { error: "The stored snapshot could not be read." },
        { status: 500 },
      );
    }
    const summary = toSnapshotSummary(row, latest?.version ?? row.version);
    const issuedAt = row.createdAt.toISOString();
    const assessment = withSnapshot(
      { ...parsed.assessment, generatedAt: issuedAt },
      {
        version: row.version,
        issuedAt,
        issuedBy: row.createdByLabel,
        note: row.note,
        contentHash: row.contentHash,
        requirement: summary.requirement,
        status: summary.status,
        signoffs: summary.signoffs,
        integrity: parsed.intact ? "VERIFIED" : "FAILED",
      },
    );

    const base = `${fileSlug(assessment.record.projectName)}-threat-model-v${row.version}-${issuedAt.slice(0, 10)}`;
    return reportResponse(assessment, requested, url.searchParams.get("download") === "1", base);
  } catch (err) {
    return errorResponse(err);
  }
}
