import { NextResponse } from "next/server";
import { assertFindingInProject } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { AuthzError, errorResponse, requireProjectAccess } from "@/lib/authz";
import { currentActor } from "@/lib/auth";
import { buildFindingEmail, isEmail, sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string; fid: string } };

// Send an immediate email alert to the finding's owner.
export async function POST(_req: Request, { params }: Params) {
  try {
    const actor = await currentActor();
    await requireProjectAccess(actor.id, params.id, { write: true });
    await assertFindingInProject(params.fid, params.id);

    const finding = await prisma.finding.findUnique({
      where: { id: params.fid },
      include: { project: { select: { name: true } } },
    });
    if (!finding) throw new AuthzError(404, "Finding not found.");

    const owner = finding.owner.trim();
    if (!owner) throw new AuthzError(400, "This finding has no owner assigned.");
    if (!isEmail(owner)) {
      throw new AuthzError(400, "The owner is not an email address, so no alert can be sent.");
    }

    const message = buildFindingEmail({
      projectId: params.id,
      projectName: finding.project.name,
      finding: {
        title: finding.title,
        severity: finding.severity,
        status: finding.status,
        description: finding.description,
        recommendation: finding.recommendation,
        dueDate: finding.dueDate,
      },
      kind: "alert",
    });
    const result = await sendEmail({ ...message, to: owner });

    await prisma.finding.update({
      where: { id: params.fid },
      data: { lastAlertAt: new Date() },
    });
    await recordAudit({
      projectId: params.id,
      findingId: params.fid,
      actorId: actor.id,
      actorLabel: actor.label,
      action: "ALERT_SENT",
      detail: `${result.transport === "smtp" ? "Emailed" : "Logged"} alert to ${owner}`,
    });

    return NextResponse.json({
      ok: true,
      to: owner,
      delivered: result.delivered,
      transport: result.transport,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
