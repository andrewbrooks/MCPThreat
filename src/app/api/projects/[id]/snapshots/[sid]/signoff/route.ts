import { NextResponse } from "next/server";
import { AuthzError, errorResponse, requireProjectAccess } from "@/lib/authz";
import { parseJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { currentActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canSignOff } from "@/lib/signoff";
import { toSnapshotSummary } from "@/lib/snapshot-loader";
import { PARTY_SIDE_LABELS } from "@/lib/taxonomy";
import { snapshotSignoffSchema } from "@/lib/validators";
import type { SnapshotRequirement } from "@/lib/workflow-types";

type Params = { params: { id: string; sid: string } };

// POST /api/projects/:id/snapshots/:sid/signoff { decision, comment? } -> { snapshot }
export async function POST(req: Request, { params }: Params) {
  try {
    const actor = await currentActor();
    const access = await requireProjectAccess(actor.id, params.id, { write: true });
    const data = await parseJson(req, snapshotSignoffSchema);

    const snap = await prisma.assessmentSnapshot.findFirst({
      where: { id: params.sid, projectId: params.id },
      select: { id: true, version: true, requirement: true, createdById: true },
    });
    if (!snap) throw new AuthzError(404, "Snapshot not found.");

    if (data.decision === "RETURN" && !data.comment) {
      throw new AuthzError(400, "A comment is required when returning a snapshot.");
    }

    const existing = await prisma.snapshotSignoff.findMany({ where: { snapshotId: snap.id } });
    const requirement = snap.requirement as SnapshotRequirement;
    const check = canSignOff(
      requirement,
      existing,
      { userId: actor.id, side: access.side },
      snap.createdById,
    );
    if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 409 });

    await prisma.snapshotSignoff.create({
      data: {
        snapshotId: snap.id,
        side: access.side,
        decision: data.decision === "APPROVE" ? "APPROVED" : "RETURNED",
        comment: data.comment ?? "",
        userId: actor.id,
        userLabel: actor.label,
      },
    });

    const sideLabel = PARTY_SIDE_LABELS[access.side];
    await recordAudit({
      projectId: params.id,
      actorId: actor.id,
      actorLabel: actor.label,
      action: data.decision === "APPROVE" ? "SNAPSHOT_APPROVED" : "SNAPSHOT_RETURNED",
      newValue: String(snap.version),
      detail:
        data.decision === "APPROVE"
          ? `recorded ${sideLabel.toLowerCase()} approval of snapshot v${snap.version}${data.comment ? `: ${data.comment}` : ""}`
          : `returned snapshot v${snap.version} for changes: ${data.comment}`,
    });

    const [row, latest] = await Promise.all([
      prisma.assessmentSnapshot.findUniqueOrThrow({
        where: { id: snap.id },
        include: { signoffs: true },
      }),
      prisma.assessmentSnapshot.findFirst({
        where: { projectId: params.id },
        orderBy: { version: "desc" },
        select: { version: true },
      }),
    ]);
    return NextResponse.json({ snapshot: toSnapshotSummary(row, latest?.version ?? row.version) });
  } catch (err) {
    return errorResponse(err);
  }
}
