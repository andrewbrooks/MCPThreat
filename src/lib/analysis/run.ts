// Orchestrates the full analysis pipeline for one project:
//   fetch (GitHub API) → analyze (Claude) → persist (conservative).
// Runs synchronously; the project's analysisStatus/analysisError track progress
// so a failed run surfaces a readable message and can be retried. Shared by the
// import (analyze) and reanalyze routes.

import { prisma } from "@/lib/prisma";
import { fetchRepoBundle } from "@/lib/github";
import { analyzeRepo } from "@/lib/analysis/analyze";
import { persistAnalysis } from "@/lib/analysis/persist";

export async function runAnalysis(
  projectId: string,
  repoUrl: string,
  token?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await prisma.project.update({
    where: { id: projectId },
    data: { analysisStatus: "ANALYZING", analysisError: null },
  });

  try {
    const bundle = await fetchRepoBundle(repoUrl, token);
    const result = await analyzeRepo(bundle);
    await persistAnalysis(projectId, bundle, result);

    await prisma.project.update({
      where: { id: projectId },
      data: {
        analysisStatus: "READY",
        analysisError: null,
        analyzedAt: new Date(),
        repoRef: bundle.ref,
      },
    });
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Analysis failed.";
    await prisma.project.update({
      where: { id: projectId },
      data: { analysisStatus: "FAILED", analysisError: error.slice(0, 1000) },
    });
    return { ok: false, error };
  }
}
