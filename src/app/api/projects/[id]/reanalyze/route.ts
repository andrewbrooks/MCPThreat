import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJson } from "@/lib/api";
import { AuthzError, errorResponse, requireProjectAccess } from "@/lib/authz";
import { currentUserId } from "@/lib/auth";
import { isAnalysisConfigured } from "@/lib/analysis/analyze";
import { runAnalysis } from "@/lib/analysis/run";

export const maxDuration = 120;

// Reanalyze only takes an optional token; the repo URL comes from the project.
const reanalyzeSchema = z.object({ token: z.string().trim().max(255).optional() }).strict();

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await currentUserId();
    const access = await requireProjectAccess(userId, params.id, { write: true });
    if (!access.isOwner) {
      throw new AuthzError(403, "Only the project owner can re-run analysis.");
    }
    if (!isAnalysisConfigured()) {
      throw new AuthzError(
        400,
        "Automated analysis is not configured on this server (ANTHROPIC_API_KEY is unset).",
      );
    }

    const repoUrl = access.project?.repoUrl;
    if (!repoUrl) {
      throw new AuthzError(400, "This project was not imported from a GitHub repository.");
    }

    const { token } = await parseJson(req, reanalyzeSchema);
    const outcome = await runAnalysis(params.id, repoUrl, token);

    return NextResponse.json(
      { status: outcome.ok ? "READY" : "FAILED", error: outcome.ok ? undefined : outcome.error },
      { status: 200 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
