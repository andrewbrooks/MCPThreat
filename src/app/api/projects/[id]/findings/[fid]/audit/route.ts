import { NextResponse } from "next/server";
import { assertFindingInProject } from "@/lib/api";
import { errorResponse, requireProjectAccess } from "@/lib/authz";
import { currentActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string; fid: string } };

export async function GET(_req: Request, { params }: Params) {
  try {
    const actor = await currentActor();
    await requireProjectAccess(actor.id, params.id);
    await assertFindingInProject(params.fid, params.id);
    const events = await prisma.auditEvent.findMany({
      where: { findingId: params.fid, projectId: params.id },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ events });
  } catch (err) {
    return errorResponse(err);
  }
}
