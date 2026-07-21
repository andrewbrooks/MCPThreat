// Persist a validated AnalysisResult onto a project, conservatively. Thresholds:
//   - trust boundaries + threat vectors: confidence >= MEDIUM
//   - findings: confidence === HIGH only
// Everything created here is tagged source = "AI" with its confidence, and the
// evidence field carries the cited file paths so a reviewer can verify. Vectors
// attach to a persisted boundary by label; findings attach to a persisted vector
// by title — items whose parent was dropped are skipped rather than orphaned.

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { ensureThreatModelId } from "@/lib/api";
import { dataflowSchema, serializeDataflow, type Dataflow } from "@/lib/dataflow";
import type { Confidence } from "@/lib/taxonomy";
import type { AnalysisResult } from "@/lib/analysis/analyze";
import type { RepoBundle } from "@/lib/github";

const CONFIDENCE_RANK: Record<Confidence, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };
const atLeast = (c: Confidence, floor: Confidence) => CONFIDENCE_RANK[c] >= CONFIDENCE_RANK[floor];

export interface PersistCounts {
  boundaries: number;
  vectors: number;
  findings: number;
}

/** Build the storable dataflow JSON from the analysis, or null if empty/invalid. */
function buildDataflowJson(result: AnalysisResult): string | null {
  if (!result.dataflow.nodes.length) return null;
  const candidate: Dataflow = {
    nodes: result.dataflow.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      type: n.type,
      tier: n.tier,
      trustZone: n.trustZone || undefined,
    })),
    edges: result.dataflow.edges.map((e, i) => ({
      id: `e${i}`,
      from: e.from,
      to: e.to,
      label: e.label || "",
      dataClass: e.dataClass || undefined,
      crossesBoundary: e.crossesBoundary ?? false,
    })),
  };
  const parsed = dataflowSchema.safeParse(candidate);
  if (!parsed.success) return null;
  return serializeDataflow(parsed.data);
}

/**
 * Write the analysis to the project inside a transaction, then record audit
 * events for AI-created findings. Returns how many items were persisted.
 */
export async function persistAnalysis(
  projectId: string,
  bundle: RepoBundle,
  result: AnalysisResult,
): Promise<PersistCounts> {
  const threatModelId = await ensureThreatModelId(projectId);
  const dataflowJson = buildDataflowJson(result);
  const techStack = [...new Set(result.techStack.map((t) => t.trim()).filter(Boolean))].join(", ");

  const createdFindingIds: { id: string; title: string }[] = [];

  const counts = await prisma.$transaction(async (tx) => {
    await tx.threatModel.update({
      where: { id: threatModelId },
      data: { dataflow: dataflowJson },
    });

    await tx.project.update({
      where: { id: projectId },
      data: {
        architecture: result.architectureMarkdown || undefined,
        techStack,
      },
    });

    // Boundaries (>= MEDIUM), keyed by label for vector attachment.
    const boundaryIdByLabel = new Map<string, string>();
    let boundaryCount = 0;
    for (const b of result.boundaries) {
      if (!atLeast(b.confidence, "MEDIUM")) continue;
      if (boundaryIdByLabel.has(b.label)) continue;
      const created = await tx.trustBoundary.create({
        data: {
          threatModelId,
          label: b.label,
          description: b.description,
          type: b.type,
          source: "AI",
        },
        select: { id: true },
      });
      boundaryIdByLabel.set(b.label, created.id);
      boundaryCount += 1;
    }

    // Vectors (>= MEDIUM) attached to a persisted boundary, keyed by title.
    const vectorIdByTitle = new Map<string, string>();
    let vectorCount = 0;
    for (const v of result.vectors) {
      if (!atLeast(v.confidence, "MEDIUM")) continue;
      const boundaryId = boundaryIdByLabel.get(v.boundaryLabel);
      if (!boundaryId) continue; // parent boundary was not persisted — skip
      const created = await tx.threatVector.create({
        data: {
          trustBoundaryId: boundaryId,
          title: v.title,
          description: v.description,
          strideCategory: v.strideCategory,
          mcpCategory: v.mcpCategory,
          likelihood: v.likelihood,
          impact: v.impact,
          source: "AI",
          confidence: v.confidence,
        },
        select: { id: true },
      });
      if (!vectorIdByTitle.has(v.title)) vectorIdByTitle.set(v.title, created.id);
      vectorCount += 1;
    }

    // Findings (HIGH only) attached to a persisted vector.
    let findingCount = 0;
    for (const f of result.findings) {
      if (f.confidence !== "HIGH") continue;
      const vectorId = vectorIdByTitle.get(f.vectorTitle);
      if (!vectorId) continue; // parent vector was not persisted — skip
      const created = await tx.finding.create({
        data: {
          threatVectorId: vectorId,
          projectId,
          title: f.title,
          description: f.description,
          recommendation: f.recommendation,
          severity: f.severity,
          evidence: f.evidence,
          source: "AI",
          confidence: f.confidence,
        },
        select: { id: true, title: true },
      });
      createdFindingIds.push(created);
      findingCount += 1;
    }

    return { boundaries: boundaryCount, vectors: vectorCount, findings: findingCount };
  });

  // Audit trail for AI-created findings (append-only; outside the txn is fine).
  for (const f of createdFindingIds) {
    await recordAudit({
      projectId,
      findingId: f.id,
      actorId: null,
      actorLabel: "auto-analysis",
      action: "CREATED",
      detail: `AI-suggested from ${bundle.owner}/${bundle.repo}: ${f.title}`,
    });
  }

  return counts;
}
