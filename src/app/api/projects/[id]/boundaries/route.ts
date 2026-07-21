import { NextResponse } from "next/server";
import { ensureThreatModelId, parseJson } from "@/lib/api";
import { errorResponse, requireProjectAccess } from "@/lib/authz";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createBoundarySchema } from "@/lib/validators";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  try {
    const userId = await currentUserId();
    await requireProjectAccess(userId, params.id);
    const threatModel = await prisma.threatModel.findUnique({
      where: { projectId: params.id },
      include: {
        boundaries: {
          orderBy: { createdAt: "asc" },
          include: { vectors: { orderBy: { createdAt: "asc" } } },
        },
      },
    });
    return NextResponse.json({ boundaries: threatModel?.boundaries ?? [] });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const userId = await currentUserId();
    await requireProjectAccess(userId, params.id, { write: true });
    const data = await parseJson(req, createBoundarySchema);
    const threatModelId = await ensureThreatModelId(params.id);
    const boundary = await prisma.trustBoundary.create({
      data: {
        threatModelId,
        label: data.label,
        description: data.description ?? "",
        type: data.type,
      },
    });
    return NextResponse.json({ boundary }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
