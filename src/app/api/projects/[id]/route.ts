import { NextResponse } from "next/server";
import { parseJson } from "@/lib/api";
import { AuthzError, errorResponse, requireProjectAccess } from "@/lib/authz";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkMcpServerUrl } from "@/lib/url-safety";
import { updateProjectSchema } from "@/lib/validators";

const allowLoopback = process.env.NODE_ENV !== "production";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  try {
    const userId = await currentUserId();
    await requireProjectAccess(userId, params.id);
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: { threatModel: true, members: true },
    });
    return NextResponse.json({ project });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const userId = await currentUserId();
    await requireProjectAccess(userId, params.id, { write: true });
    const data = await parseJson(req, updateProjectSchema);

    if (data.mcpServerUrl) {
      const check = checkMcpServerUrl(data.mcpServerUrl, allowLoopback);
      if (!check.ok) throw new AuthzError(400, `Unsafe MCP server URL: ${check.reason}`);
    }

    const project = await prisma.project.update({
      where: { id: params.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.mcpServerUrl !== undefined
          ? { mcpServerUrl: data.mcpServerUrl || null }
          : {}),
        ...(data.architecture !== undefined ? { architecture: data.architecture } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.acceptancePolicy !== undefined
          ? { acceptancePolicy: data.acceptancePolicy }
          : {}),
      },
    });
    return NextResponse.json({ project });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const userId = await currentUserId();
    const { isOwner } = await requireProjectAccess(userId, params.id, { write: true });
    if (!isOwner) throw new AuthzError(403, "Only the project owner can delete a project.");
    await prisma.project.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
