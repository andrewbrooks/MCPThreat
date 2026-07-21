import { NextResponse } from "next/server";
import { parseJson } from "@/lib/api";
import { AuthzError, errorResponse } from "@/lib/authz";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateProfileSchema } from "@/lib/validators";

export async function PATCH(req: Request) {
  try {
    const userId = await currentUserId();
    if (!userId) throw new AuthzError(401, "Authentication required.");
    const data = await parseJson(req, updateProfileSchema);
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.image !== undefined ? { image: data.image || null } : {}),
      },
      select: { id: true, name: true, email: true, image: true },
    });
    return NextResponse.json({ user });
  } catch (err) {
    return errorResponse(err);
  }
}
