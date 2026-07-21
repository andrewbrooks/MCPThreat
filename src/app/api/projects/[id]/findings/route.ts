import { NextResponse } from "next/server";
import {
  assertVectorInProject,
  computeReminderNext,
  computeReviewDue,
  normalizeDueDate,
  parseJson,
} from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { AuthzError, errorResponse, requireProjectAccess } from "@/lib/authz";
import { currentActor } from "@/lib/auth";
import { reopenDueFindings } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { isFindingStatus, isSeverity } from "@/lib/taxonomy";
import { bulkFindingStatusSchema, createFindingSchema } from "@/lib/validators";

type Params = { params: { id: string } };

export async function GET(req: Request, { params }: Params) {
  try {
    const actor = await currentActor();
    await requireProjectAccess(actor.id, params.id);
    await reopenDueFindings(params.id);
    const { searchParams } = new URL(req.url);
    const severity = searchParams.get("severity");
    const status = searchParams.get("status");
    const owner = searchParams.get("owner");

    const findings = await prisma.finding.findMany({
      where: {
        projectId: params.id,
        ...(severity && isSeverity(severity) ? { severity } : {}),
        ...(status && isFindingStatus(status) ? { status } : {}),
        ...(owner ? { owner: { contains: owner } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        threatVector: {
          select: { id: true, title: true, mcpCategory: true, strideCategory: true },
        },
      },
    });
    return NextResponse.json({ findings });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const actor = await currentActor();
    await requireProjectAccess(actor.id, params.id, { write: true });
    const data = await parseJson(req, createFindingSchema);
    await assertVectorInProject(data.threatVectorId, params.id);
    const finding = await prisma.finding.create({
      data: {
        threatVectorId: data.threatVectorId,
        projectId: params.id,
        title: data.title,
        description: data.description ?? "",
        recommendation: data.recommendation ?? "",
        severity: data.severity ?? "MEDIUM",
        status: data.status ?? "OPEN",
        owner: data.owner ?? "",
        dueDate: normalizeDueDate(data.dueDate) ?? null,
        evidence: data.evidence ?? "",
        reviewIntervalDays: data.reviewIntervalDays ?? null,
        reviewDueAt: computeReviewDue(data.reviewIntervalDays),
        reminderIntervalDays: data.reminderIntervalDays ?? null,
        reminderNextAt: computeReminderNext(data.reminderIntervalDays),
      },
    });
    await recordAudit({
      projectId: params.id,
      findingId: finding.id,
      actorId: actor.id,
      actorLabel: actor.label,
      action: "CREATED",
      detail: finding.title,
    });
    return NextResponse.json({ finding }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

// Bulk status change.
export async function PATCH(req: Request, { params }: Params) {
  try {
    const actor = await currentActor();
    const access = await requireProjectAccess(actor.id, params.id, { write: true });
    const data = await parseJson(req, bulkFindingStatusSchema);

    if (data.status === "PENDING_ACCEPTANCE") {
      throw new AuthzError(400, "Pending Acceptance cannot be set in bulk.");
    }
    if (data.status === "ACCEPTED" && access.project!.acceptancePolicy !== "OFF") {
      throw new AuthzError(
        400,
        "This project requires an approval to accept risk — accept findings individually.",
      );
    }

    // Never bulk-change findings that are mid-acceptance.
    const scope = {
      id: { in: data.ids },
      projectId: params.id,
      status: { not: "PENDING_ACCEPTANCE" },
    };
    const existing = await prisma.finding.findMany({
      where: scope,
      select: { id: true, status: true },
    });
    const result = await prisma.finding.updateMany({
      where: scope,
      data: { status: data.status },
    });
    for (const f of existing) {
      if (f.status !== data.status) {
        await recordAudit({
          projectId: params.id,
          findingId: f.id,
          actorId: actor.id,
          actorLabel: actor.label,
          action: "STATUS_CHANGED",
          field: "status",
          oldValue: f.status,
          newValue: data.status,
          detail: "bulk update",
        });
      }
    }
    return NextResponse.json({ updated: result.count });
  } catch (err) {
    return errorResponse(err);
  }
}
