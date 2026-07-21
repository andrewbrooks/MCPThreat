import { NextResponse } from "next/server";
import {
  assertFindingInProject,
  computeReminderNext,
  computeReviewDue,
  normalizeDueDate,
  parseJson,
} from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { AuthzError, errorResponse, requireProjectAccess } from "@/lib/authz";
import { currentActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateFindingSchema } from "@/lib/validators";

type Params = { params: { id: string; fid: string } };

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const actor = await currentActor();
    const access = await requireProjectAccess(actor.id, params.id, { write: true });
    await assertFindingInProject(params.fid, params.id);
    const data = await parseJson(req, updateFindingSchema);

    const before = await prisma.finding.findUnique({ where: { id: params.fid } });
    if (!before) throw new AuthzError(404, "Finding not found.");

    // Status transitions into/out of the acceptance workflow are managed by the
    // dedicated acceptance endpoints, not by a plain status edit.
    if (data.status !== undefined && data.status !== before.status) {
      const policy = access.project!.acceptancePolicy;
      if (data.status === "PENDING_ACCEPTANCE") {
        throw new AuthzError(400, "Pending Acceptance is set by requesting acceptance.");
      }
      if (data.status === "ACCEPTED" && policy !== "OFF") {
        throw new AuthzError(
          400,
          "This project requires an approval to accept risk — use “Request acceptance”.",
        );
      }
      if (before.status === "PENDING_ACCEPTANCE") {
        throw new AuthzError(
          400,
          "Resolve the pending acceptance request before changing status.",
        );
      }
    }

    const due = normalizeDueDate(data.dueDate);
    const finding = await prisma.finding.update({
      where: { id: params.fid },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.recommendation !== undefined ? { recommendation: data.recommendation } : {}),
        ...(data.severity !== undefined ? { severity: data.severity } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.owner !== undefined ? { owner: data.owner } : {}),
        ...(data.evidence !== undefined ? { evidence: data.evidence } : {}),
        ...(due !== undefined ? { dueDate: due } : {}),
        ...(data.reviewIntervalDays !== undefined
          ? {
              reviewIntervalDays: data.reviewIntervalDays,
              reviewDueAt: computeReviewDue(data.reviewIntervalDays),
            }
          : {}),
        ...(data.reminderIntervalDays !== undefined
          ? {
              reminderIntervalDays: data.reminderIntervalDays,
              reminderNextAt: computeReminderNext(data.reminderIntervalDays),
            }
          : {}),
      },
    });

    // Record an audit event for each tracked field that actually changed.
    const audit = (
      field: string,
      label: string,
      oldV: unknown,
      newV: unknown,
      action: "UPDATED" | "STATUS_CHANGED" = "UPDATED",
    ) =>
      recordAudit({
        projectId: params.id,
        findingId: params.fid,
        actorId: actor.id,
        actorLabel: actor.label,
        action,
        field: label,
        oldValue: fmt(oldV),
        newValue: fmt(newV),
      });

    const jobs: Promise<void>[] = [];
    if (data.status !== undefined && data.status !== before.status)
      jobs.push(audit("status", "Status", before.status, finding.status, "STATUS_CHANGED"));
    if (data.severity !== undefined && data.severity !== before.severity)
      jobs.push(audit("severity", "Severity", before.severity, finding.severity));
    if (data.title !== undefined && data.title !== before.title)
      jobs.push(audit("title", "Title", before.title, finding.title));
    if (data.owner !== undefined && data.owner !== before.owner)
      jobs.push(audit("owner", "Owner", before.owner, finding.owner));
    if (data.evidence !== undefined && data.evidence !== before.evidence)
      jobs.push(audit("evidence", "Evidence", before.evidence, finding.evidence));
    if (data.description !== undefined && data.description !== before.description)
      jobs.push(audit("description", "Description", before.description, finding.description));
    if (data.recommendation !== undefined && data.recommendation !== before.recommendation)
      jobs.push(
        audit("recommendation", "Recommendation", before.recommendation, finding.recommendation),
      );
    if (
      due !== undefined &&
      (before.dueDate?.getTime() ?? null) !== (finding.dueDate?.getTime() ?? null)
    )
      jobs.push(audit("dueDate", "Due date", before.dueDate, finding.dueDate));
    if (
      data.reviewIntervalDays !== undefined &&
      data.reviewIntervalDays !== before.reviewIntervalDays
    )
      jobs.push(
        audit(
          "reviewIntervalDays",
          "Revisit reminder",
          before.reviewIntervalDays ? `${before.reviewIntervalDays} days` : "off",
          finding.reviewIntervalDays ? `${finding.reviewIntervalDays} days` : "off",
        ),
      );
    if (
      data.reminderIntervalDays !== undefined &&
      data.reminderIntervalDays !== before.reminderIntervalDays
    )
      jobs.push(
        audit(
          "reminderIntervalDays",
          "Owner reminder",
          before.reminderIntervalDays ? `every ${before.reminderIntervalDays} days` : "off",
          finding.reminderIntervalDays ? `every ${finding.reminderIntervalDays} days` : "off",
        ),
      );
    await Promise.all(jobs);

    return NextResponse.json({ finding });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const actor = await currentActor();
    await requireProjectAccess(actor.id, params.id, { write: true });
    await assertFindingInProject(params.fid, params.id);
    const finding = await prisma.finding.findUnique({
      where: { id: params.fid },
      select: { title: true },
    });
    await prisma.finding.delete({ where: { id: params.fid } });
    await recordAudit({
      projectId: params.id,
      findingId: params.fid,
      actorId: actor.id,
      actorLabel: actor.label,
      action: "DELETED",
      detail: finding?.title ?? undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
