import { NextResponse } from "next/server";
import { errorResponse, requireProjectAccess } from "@/lib/authz";
import { currentActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string } };

export async function GET(req: Request, { params }: Params) {
  try {
    const actor = await currentActor();
    await requireProjectAccess(actor.id, params.id);
    const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || 200, 500);
    const events = await prisma.auditEvent.findMany({
      where: { projectId: params.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json({ events });
  } catch (err) {
    return errorResponse(err);
  }
}
