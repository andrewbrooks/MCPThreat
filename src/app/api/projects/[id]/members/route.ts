import { NextResponse } from "next/server";
import { parseJson } from "@/lib/api";
import { AuthzError, errorResponse, requireProjectAccess } from "@/lib/authz";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { inviteMemberSchema } from "@/lib/validators";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  try {
    const userId = await currentUserId();
    await requireProjectAccess(userId, params.id);
    const members = await prisma.projectMember.findMany({
      where: { projectId: params.id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ members });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const userId = await currentUserId();
    const { isOwner, role } = await requireProjectAccess(userId, params.id, {
      write: true,
    });
    if (!isOwner && role !== "ADMIN") {
      throw new AuthzError(403, "Only owners or admins can invite members.");
    }
    const data = await parseJson(req, inviteMemberSchema);
    const email = data.email.toLowerCase();

    // Link to an existing user account if one exists for this email.
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    const member = await prisma.projectMember.upsert({
      where: { projectId_email: { projectId: params.id, email } },
      update: {
        role: data.role ?? "MEMBER",
        side: data.side ?? "CLIENT",
        userId: existingUser?.id ?? null,
      },
      create: {
        projectId: params.id,
        email,
        role: data.role ?? "MEMBER",
        side: data.side ?? "CLIENT",
        userId: existingUser?.id ?? null,
      },
    });
    return NextResponse.json({ member }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
