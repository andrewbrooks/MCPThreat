import { NextResponse } from "next/server";
import { parseJson } from "@/lib/api";
import { AuthzError, errorResponse } from "@/lib/authz";
import { currentUserId } from "@/lib/auth";
import { listProjectSummaries } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { checkMcpServerUrl } from "@/lib/url-safety";
import { createProjectSchema } from "@/lib/validators";

const allowLoopback = process.env.NODE_ENV !== "production";

export async function GET() {
  try {
    const userId = await currentUserId();
    if (!userId) throw new AuthzError(401, "Authentication required.");
    const projects = await listProjectSummaries(userId);
    return NextResponse.json({ projects });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const userId = await currentUserId();
    if (!userId) throw new AuthzError(401, "Authentication required.");
    const data = await parseJson(req, createProjectSchema);

    if (data.mcpServerUrl) {
      const check = checkMcpServerUrl(data.mcpServerUrl, allowLoopback);
      if (!check.ok) throw new AuthzError(400, `Unsafe MCP server URL: ${check.reason}`);
    }

    const project = await prisma.project.create({
      data: {
        name: data.name,
        description: data.description ?? "",
        mcpServerUrl: data.mcpServerUrl || null,
        architecture: data.architecture ?? "",
        status: data.status ?? "ACTIVE",
        ownerId: userId,
        threatModel: { create: {} },
      },
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
