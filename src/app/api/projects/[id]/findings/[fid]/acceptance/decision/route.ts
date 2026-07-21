import { NextResponse } from "next/server";
import { isAcceptanceComplete } from "@/lib/acceptance";
import { assertFindingInProject, computeReviewDue, parseJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { AuthzError, errorResponse, requireProjectAccess } from "@/lib/authz";
import { currentActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PARTY_SIDE_LABELS } from "@/lib/taxonomy";
import { acceptanceDecisionSchema } from "@/lib/validators";

type Params = { params: { id: string; fid: string } };

export async function POST(req: Request, { params }: Params) {
  try {
    const actor = await currentActor();
    const access = await requireProjectAccess(actor.id, params.id, { write: true });
    await assertFindingInProject(params.fid, params.id);
    const data = await parseJson(req, acceptanceDecisionSchema);

    const request = await prisma.acceptanceRequest.findFirst({
      where: { findingId: params.fid, status: "PENDING" },
    });
    if (!request) throw new AuthzError(404, "No pending acceptance request.");

    const side = access.side; // ASSESSOR | CLIENT
    const sideLabel = PARTY_SIDE_LABELS[side];

    // --- Rejection ----------------------------------------------------------
    if (data.decision === "REJECT") {
      await prisma.acceptanceRequest.update({
        where: { id: request.id },
        data: {
          status: "REJECTED",
          resolvedAt: new Date(),
          rejectedById: actor.id,
          rejectedByLabel: actor.label,
          rejectedReason: data.comment ?? "",
        },
      });
      await prisma.finding.update({
        where: { id: params.fid },
        data: { status: request.priorStatus },
      });
      await recordAudit({
        projectId: params.id,
        findingId: params.fid,
        actorId: actor.id,
        actorLabel: actor.label,
        action: "ACCEPTANCE_REJECTED",
        detail: `rejected the acceptance request${data.comment ? `: ${data.comment}` : ""}`,
      });
      return NextResponse.json({ status: "REJECTED" });
    }

    // --- Approval -----------------------------------------------------------
    // Four-eyes: a single-approval request may not be approved by its requester.
    if (!request.requireBothSides && request.requestedById && request.requestedById === actor.id) {
      throw new AuthzError(403, "The requester cannot approve their own acceptance request.");
    }

    const alreadySigned =
      (side === "ASSESSOR" && request.assessorApprovedAt) ||
      (side === "CLIENT" && request.clientApprovedAt);
    if (alreadySigned) {
      throw new AuthzError(409, `The ${sideLabel.toLowerCase()} side has already signed off.`);
    }

    const now = new Date();
    const signoff =
      side === "ASSESSOR"
        ? { assessorApproverId: actor.id, assessorApproverLabel: actor.label, assessorApprovedAt: now }
        : { clientApproverId: actor.id, clientApproverLabel: actor.label, clientApprovedAt: now };

    const updated = await prisma.acceptanceRequest.update({
      where: { id: request.id },
      data: signoff,
    });

    await recordAudit({
      projectId: params.id,
      findingId: params.fid,
      actorId: actor.id,
      actorLabel: actor.label,
      action: "ACCEPTANCE_APPROVED",
      detail: `provided ${sideLabel} sign-off${data.comment ? `: ${data.comment}` : ""}`,
    });

    if (isAcceptanceComplete(updated)) {
      const reviewDueAt = computeReviewDue(updated.reviewIntervalDays);
      await prisma.acceptanceRequest.update({
        where: { id: request.id },
        data: { status: "APPROVED", resolvedAt: now, expiresAt: reviewDueAt },
      });
      await prisma.finding.update({
        where: { id: params.fid },
        data: {
          status: "ACCEPTED",
          reviewIntervalDays: updated.reviewIntervalDays,
          reviewDueAt,
        },
      });
      await recordAudit({
        projectId: params.id,
        findingId: params.fid,
        actorId: actor.id,
        actorLabel: actor.label,
        action: "RISK_ACCEPTED",
        detail: reviewDueAt
          ? `risk accepted — expires ${reviewDueAt.toISOString().slice(0, 10)}`
          : "risk accepted",
      });
      return NextResponse.json({ status: "ACCEPTED" });
    }

    return NextResponse.json({ status: "PENDING", signedBy: side });
  } catch (err) {
    return errorResponse(err);
  }
}
