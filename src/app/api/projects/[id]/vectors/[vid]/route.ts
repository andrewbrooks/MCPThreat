import { NextResponse } from "next/server";
import { assertVectorInProject, parseJson } from "@/lib/api";
import { errorResponse, requireProjectAccess } from "@/lib/authz";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateVectorSchema } from "@/lib/validators";

type Params = { params: { id: string; vid: string } };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const userId = await currentUserId();
    await requireProjectAccess(userId, params.id, { write: true });
    await assertVectorInProject(params.vid, params.id);
    const data = await parseJson(req, updateVectorSchema);
    const vector = await prisma.threatVector.update({
      where: { id: params.vid },
      data,
    });
    return NextResponse.json({ vector });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const userId = await currentUserId();
    await requireProjectAccess(userId, params.id, { write: true });
    await assertVectorInProject(params.vid, params.id);
    await prisma.threatVector.delete({ where: { id: params.vid } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
