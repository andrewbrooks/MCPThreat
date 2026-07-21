import { NextResponse } from "next/server";
import { errorResponse, requireProjectAccess } from "@/lib/authz";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateReport, type ReportProject } from "@/lib/report";

type Params = { params: { id: string } };

// GET generates the markdown threat-model report. ?format=json returns it wrapped
// in JSON; otherwise the raw markdown is returned as text/markdown.
export async function GET(req: Request, { params }: Params) {
  try {
    const userId = await currentUserId();
    await requireProjectAccess(userId, params.id);

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        findings: true,
        threatModel: {
          include: {
            boundaries: {
              orderBy: { createdAt: "asc" },
              include: { vectors: { orderBy: { createdAt: "asc" } } },
            },
          },
        },
      },
    });
    if (!project) throw new Error("Project not found after access check.");

    const reportInput: ReportProject = {
      name: project.name,
      description: project.description,
      mcpServerUrl: project.mcpServerUrl,
      architecture: project.architecture,
      status: project.status,
      boundaries: project.threatModel?.boundaries ?? [],
      findings: project.findings,
    };
    const markdown = generateReport(reportInput);

    const format = new URL(req.url).searchParams.get("format");
    if (format === "json") {
      return NextResponse.json({ markdown });
    }
    return new NextResponse(markdown, {
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
