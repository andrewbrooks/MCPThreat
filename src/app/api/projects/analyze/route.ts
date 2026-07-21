import { NextResponse } from "next/server";
import { parseJson } from "@/lib/api";
import { AuthzError, errorResponse } from "@/lib/authz";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeRepoSchema } from "@/lib/validators";
import { parseRepoUrl, GithubError } from "@/lib/github";
import { isAnalysisConfigured } from "@/lib/analysis/analyze";
import { runAnalysis } from "@/lib/analysis/run";

// Synchronous analysis can take up to ~1 minute; give the handler headroom.
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const userId = await currentUserId();
    if (!userId) throw new AuthzError(401, "Authentication required.");

    if (!isAnalysisConfigured()) {
      throw new AuthzError(
        400,
        "Automated analysis is not configured on this server (ANTHROPIC_API_KEY is unset).",
      );
    }

    const data = await parseJson(req, analyzeRepoSchema);

    // Validate + normalize the repo URL (host-locked to github.com).
    let owner: string;
    let repo: string;
    try {
      ({ owner, repo } = parseRepoUrl(data.repoUrl));
    } catch (err) {
      if (err instanceof GithubError) throw new AuthzError(400, err.message);
      throw err;
    }
    const normalizedUrl = `https://github.com/${owner}/${repo}`;

    // Create the project up front so the UI can navigate to it and show progress.
    const project = await prisma.project.create({
      data: {
        name: `${owner}/${repo}`,
        description: `Imported from ${normalizedUrl}`,
        repoUrl: normalizedUrl,
        sourceType: "GITHUB",
        analysisStatus: "ANALYZING",
        ownerId: userId,
        threatModel: { create: {} },
      },
      select: { id: true },
    });

    // Token is used per-request only and never written to the DB.
    const outcome = await runAnalysis(project.id, normalizedUrl, data.token);

    return NextResponse.json(
      { projectId: project.id, status: outcome.ok ? "READY" : "FAILED", error: outcome.ok ? undefined : outcome.error },
      { status: 201 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
