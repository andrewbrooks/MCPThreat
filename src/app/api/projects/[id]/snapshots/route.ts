import { NextResponse } from "next/server";
import { parseJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { currentActor } from "@/lib/auth";
import { errorResponse, requireProjectAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { loadProjectWorkflow } from "@/lib/readiness-loader";
import { assessmentContentHash, serialiseForSnapshot } from "@/lib/snapshot";
import { toSnapshotSummary } from "@/lib/snapshot-loader";
import { listSnapshotSummaries } from "@/lib/snapshot-loader";
import { snapshotRequirement } from "@/lib/signoff";
import { issueSnapshotSchema } from "@/lib/validators";

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/:id/snapshots -> { snapshots: SnapshotSummary[] }
export async function GET(_req: Request, { params: paramsPromise }: Params) {
  const params = await paramsPromise;
  try {
    const actor = await currentActor();
    await requireProjectAccess(actor.id, params.id);
    return NextResponse.json({ snapshots: await listSnapshotSummaries(params.id) });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/projects/:id/snapshots { note? } -> 201 { snapshot }
// 409 { error, checks } when blocking readiness checks fail.
export async function POST(req: Request, { params: paramsPromise }: Params) {
  const params = await paramsPromise;
  try {
    const actor = await currentActor();
    const access = await requireProjectAccess(actor.id, params.id, { write: true });
    const data = await parseJson(req, issueSnapshotSchema);

    const workflow = await loadProjectWorkflow(params.id);
    if (!workflow) return NextResponse.json({ error: "Project not found." }, { status: 404 });

    if (!workflow.readiness.canIssue) {
      const checks = workflow.readiness.stages
        .flatMap((s) => s.checks)
        .filter((c) => c.level === "BLOCKER" && !c.passed);
      return NextResponse.json(
        {
          error: "The assessment has blocking issues. Resolve them before issuing a snapshot.",
          checks,
        },
        { status: 409 },
      );
    }

    const requirement = snapshotRequirement(access.project?.acceptancePolicy ?? "OFF");
    const contentHash = assessmentContentHash(workflow.assessment);
    const assessment = serialiseForSnapshot(workflow.assessment);

    let created: Awaited<ReturnType<typeof createOnce>> | null = null;
    for (let attempt = 0; attempt < 2 && !created; attempt++) {
      try {
        created = await createOnce();
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code !== "P2002" || attempt === 1) throw err;
      }
    }
    if (!created) throw new Error("Could not create snapshot.");

    async function createOnce() {
      const latest = await prisma.assessmentSnapshot.findFirst({
        where: { projectId: params.id },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const version = (latest?.version ?? 0) + 1;
      const row = await prisma.assessmentSnapshot.create({
        data: {
          projectId: params.id,
          version,
          note: data.note ?? "",
          requirement,
          contentHash,
          assessment,
          createdById: actor.id,
          createdByLabel: actor.label,
        },
        include: { signoffs: true },
      });
      return row;
    }

    await recordAudit({
      projectId: params.id,
      actorId: actor.id,
      actorLabel: actor.label,
      action: "SNAPSHOT_ISSUED",
      newValue: String(created.version),
      detail: `issued snapshot v${created.version}${data.note ? `: ${data.note}` : ""}`,
    });

    return NextResponse.json(
      { snapshot: toSnapshotSummary(created, created.version) },
      { status: 201 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
