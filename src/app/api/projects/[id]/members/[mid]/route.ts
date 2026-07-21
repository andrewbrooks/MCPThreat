import { NextResponse } from "next/server";
import { AuthzError, errorResponse, requireProjectAccess } from "@/lib/authz";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string; mid: string } };

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const userId = await currentUserId();
    const { isOwner, role } = await requireProjectAccess(userId, params.id, {
      write: true,
    });
    if (!isOwner && role !== "ADMIN") {
      throw new AuthzError(403, "Only owners or admins can remove members.");
    }
    const member = await prisma.projectMember.findUnique({
      where: { id: params.mid },
      select: { projectId: true },
    });
    if (!member || member.projectId !== params.id) {
      throw new AuthzError(404, "Member not found in this project.");
    }
    await prisma.projectMember.delete({ where: { id: params.mid } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
