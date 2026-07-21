import { NextResponse } from "next/server";
import { ensureThreatModelId, parseJson } from "@/lib/api";
import { errorResponse, requireProjectAccess } from "@/lib/authz";
import { currentUserId } from "@/lib/auth";
import { completionPct } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";
import { updateThreatModelSchema } from "@/lib/validators";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  try {
    const userId = await currentUserId();
    await requireProjectAccess(userId, params.id);
    const threatModel = await prisma.threatModel.findUnique({
      where: { projectId: params.id },
      include: { boundaries: { include: { vectors: { select: { id: true } } } } },
    });
    const findings = await prisma.finding.findMany({
      where: { projectId: params.id },
      select: { status: true, threatVectorId: true, severity: true },
    });
    const vectors = threatModel?.boundaries.flatMap((b) => b.vectors) ?? [];
    return NextResponse.json({
      threatModel: threatModel
        ? { id: threatModel.id, notes: threatModel.notes }
        : null,
      completionPct: completionPct(vectors, findings),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const userId = await currentUserId();
    await requireProjectAccess(userId, params.id, { write: true });
    const data = await parseJson(req, updateThreatModelSchema);
    await ensureThreatModelId(params.id);
    const threatModel = await prisma.threatModel.update({
      where: { projectId: params.id },
      data: { notes: data.notes },
    });
    return NextResponse.json({ threatModel });
  } catch (err) {
    return errorResponse(err);
  }
}
