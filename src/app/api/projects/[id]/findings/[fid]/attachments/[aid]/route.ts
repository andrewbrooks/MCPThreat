import { NextResponse } from "next/server";
import { assertFindingInProject } from "@/lib/api";
import { safeFilename } from "@/lib/attachments";
import { recordAudit } from "@/lib/audit";
import { AuthzError, errorResponse, requireProjectAccess } from "@/lib/authz";
import { currentActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string; fid: string; aid: string } };

async function loadOwned(aid: string, findingId: string, projectId: string) {
  const attachment = await prisma.attachment.findUnique({ where: { id: aid } });
  if (!attachment || attachment.findingId !== findingId || attachment.projectId !== projectId) {
    throw new AuthzError(404, "Attachment not found in this finding.");
  }
  return attachment;
}

// Download the attachment.
export async function GET(_req: Request, { params }: Params) {
  try {
    const actor = await currentActor();
    await requireProjectAccess(actor.id, params.id);
    await assertFindingInProject(params.fid, params.id);
    const attachment = await loadOwned(params.aid, params.fid, params.id);

    const body = new Uint8Array(attachment.data);
    return new NextResponse(body, {
      headers: {
        "Content-Type": attachment.mimeType || "application/octet-stream",
        "Content-Length": String(attachment.size),
        "Content-Disposition": `attachment; filename="${safeFilename(attachment.filename)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const actor = await currentActor();
    await requireProjectAccess(actor.id, params.id, { write: true });
    await assertFindingInProject(params.fid, params.id);
    const attachment = await loadOwned(params.aid, params.fid, params.id);

    await prisma.attachment.delete({ where: { id: attachment.id } });
    await recordAudit({
      projectId: params.id,
      findingId: params.fid,
      actorId: actor.id,
      actorLabel: actor.label,
      action: "ATTACHMENT_REMOVED",
      detail: attachment.filename,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
