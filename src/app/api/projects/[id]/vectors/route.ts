import { NextResponse } from "next/server";
import { assertBoundaryInProject, parseJson } from "@/lib/api";
import { errorResponse, requireProjectAccess } from "@/lib/authz";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createVectorSchema } from "@/lib/validators";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  try {
    const userId = await currentUserId();
    await requireProjectAccess(userId, params.id);
    const threatModel = await prisma.threatModel.findUnique({
      where: { projectId: params.id },
      select: { id: true },
    });
    const vectors = threatModel
      ? await prisma.threatVector.findMany({
          where: { trustBoundary: { threatModelId: threatModel.id } },
          orderBy: { createdAt: "asc" },
          include: { findings: { orderBy: { createdAt: "desc" } } },
        })
      : [];
    return NextResponse.json({ vectors });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const userId = await currentUserId();
    await requireProjectAccess(userId, params.id, { write: true });
    const data = await parseJson(req, createVectorSchema);
    await assertBoundaryInProject(data.trustBoundaryId, params.id);
    const vector = await prisma.threatVector.create({
      data: {
        trustBoundaryId: data.trustBoundaryId,
        title: data.title,
        description: data.description ?? "",
        strideCategory: data.strideCategory,
        mcpCategory: data.mcpCategory,
        likelihood: data.likelihood ?? "MEDIUM",
        impact: data.impact ?? "MEDIUM",
      },
    });
    return NextResponse.json({ vector }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
