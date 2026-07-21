import { NextResponse } from "next/server";
import { assertFindingInProject } from "@/lib/api";
import {
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  humanSize,
  isAllowedAttachment,
} from "@/lib/attachments";
import { recordAudit } from "@/lib/audit";
import { AuthzError, errorResponse, requireProjectAccess } from "@/lib/authz";
import { currentActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string; fid: string } };

export async function GET(_req: Request, { params }: Params) {
  try {
    const actor = await currentActor();
    await requireProjectAccess(actor.id, params.id);
    await assertFindingInProject(params.fid, params.id);
    const attachments = await prisma.attachment.findMany({
      where: { findingId: params.fid },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        size: true,
        uploadedByLabel: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ attachments });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const actor = await currentActor();
    await requireProjectAccess(actor.id, params.id, { write: true });
    await assertFindingInProject(params.fid, params.id);

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      throw new AuthzError(400, "No file provided.");
    }
    if (file.size === 0) throw new AuthzError(400, "File is empty.");
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new AuthzError(400, `File exceeds the ${humanSize(MAX_ATTACHMENT_BYTES)} limit.`);
    }
    if (!isAllowedAttachment(file.type, file.name)) {
      throw new AuthzError(
        400,
        `Unsupported file type. Allowed: ${Object.values(ALLOWED_ATTACHMENT_TYPES).flat().join(", ")}.`,
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const created = await prisma.attachment.create({
      data: {
        findingId: params.fid,
        projectId: params.id,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        size: bytes.length,
        data: bytes,
        uploadedById: actor.id,
        uploadedByLabel: actor.label,
      },
      select: { id: true, filename: true, mimeType: true, size: true, createdAt: true },
    });

    await recordAudit({
      projectId: params.id,
      findingId: params.fid,
      actorId: actor.id,
      actorLabel: actor.label,
      action: "ATTACHMENT_ADDED",
      detail: file.name,
    });

    return NextResponse.json({ attachment: created }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
