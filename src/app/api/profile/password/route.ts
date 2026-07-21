import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { parseJson } from "@/lib/api";
import { AuthzError, errorResponse } from "@/lib/authz";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { changePasswordSchema } from "@/lib/validators";

export async function POST(req: Request) {
  try {
    const userId = await currentUserId();
    if (!userId) throw new AuthzError(401, "Authentication required.");

    const data = await parseJson(req, changePasswordSchema);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new AuthzError(404, "User not found.");

    // If the account already has a password, the current one must be provided and correct.
    if (user.passwordHash) {
      if (!data.currentPassword) {
        throw new AuthzError(400, "Current password is required.");
      }
      const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!valid) throw new AuthzError(400, "Current password is incorrect.");
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
