import { NextResponse } from "next/server";
import { assertBoundaryInProject, parseJson } from "@/lib/api";
import { errorResponse, requireProjectAccess } from "@/lib/authz";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateBoundarySchema } from "@/lib/validators";

type Params = { params: { id: string; bid: string } };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const userId = await currentUserId();
    await requireProjectAccess(userId, params.id, { write: true });
    await assertBoundaryInProject(params.bid, params.id);
    const data = await parseJson(req, updateBoundarySchema);
    const boundary = await prisma.trustBoundary.update({
      where: { id: params.bid },
      data,
    });
    return NextResponse.json({ boundary });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const userId = await currentUserId();
    await requireProjectAccess(userId, params.id, { write: true });
    await assertBoundaryInProject(params.bid, params.id);
    await prisma.trustBoundary.delete({ where: { id: params.bid } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
