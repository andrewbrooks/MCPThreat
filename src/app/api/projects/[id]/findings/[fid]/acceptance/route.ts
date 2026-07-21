import { NextResponse } from "next/server";
import { acceptanceRequirement } from "@/lib/acceptance";
import { assertFindingInProject, parseJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { AuthzError, errorResponse, requireProjectAccess } from "@/lib/authz";
import { currentActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requestAcceptanceSchema } from "@/lib/validators";

type Params = { params: { id: string; fid: string } };

// Open a risk-acceptance request. Moves the finding to PENDING_ACCEPTANCE until the
// required sign-offs are collected.
export async function POST(req: Request, { params }: Params) {
  try {
    const actor = await currentActor();
    const access = await requireProjectAccess(actor.id, params.id, { write: true });
    await assertFindingInProject(params.fid, params.id);

    const finding = await prisma.finding.findUnique({ where: { id: params.fid } });
    if (!finding) throw new AuthzError(404, "Finding not found.");

    const requirement = acceptanceRequirement(
      access.project!.acceptancePolicy,
      finding.severity,
    );
    if (requirement === "NONE") {
      throw new AuthzError(
        400,
        "This project accepts risks directly — set the status to Accepted instead.",
      );
    }
    if (finding.status === "ACCEPTED") {
      throw new AuthzError(400, "This finding is already accepted.");
    }

    const openReq = await prisma.acceptanceRequest.findFirst({
      where: { findingId: params.fid, status: "PENDING" },
    });
    if (openReq) throw new AuthzError(409, "An acceptance request is already pending.");

    const data = await parseJson(req, requestAcceptanceSchema);
    const requireBothSides = requirement === "DUAL";

    const request = await prisma.acceptanceRequest.create({
      data: {
        findingId: params.fid,
        projectId: params.id,
        status: "PENDING",
        requireBothSides,
        justification: data.justification,
        residualRisk: data.residualRisk ?? "",
        priorStatus: finding.status,
        reviewIntervalDays: data.reviewIntervalDays ?? null,
        requestedById: actor.id,
        requestedByLabel: actor.label,
      },
    });
    await prisma.finding.update({
      where: { id: params.fid },
      data: { status: "PENDING_ACCEPTANCE" },
    });
    await recordAudit({
      projectId: params.id,
      findingId: params.fid,
      actorId: actor.id,
      actorLabel: actor.label,
      action: "ACCEPTANCE_REQUESTED",
      detail: requireBothSides
        ? "requested risk acceptance (needs assessor + client sign-off)"
        : "requested risk acceptance (needs one approval)",
    });

    return NextResponse.json({ request }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

// Cancel the pending request and restore the finding's prior status.
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const actor = await currentActor();
    await requireProjectAccess(actor.id, params.id, { write: true });
    await assertFindingInProject(params.fid, params.id);

    const request = await prisma.acceptanceRequest.findFirst({
      where: { findingId: params.fid, status: "PENDING" },
    });
    if (!request) throw new AuthzError(404, "No pending acceptance request.");

    await prisma.acceptanceRequest.update({
      where: { id: request.id },
      data: { status: "CANCELLED", resolvedAt: new Date() },
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
      action: "ACCEPTANCE_CANCELLED",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
