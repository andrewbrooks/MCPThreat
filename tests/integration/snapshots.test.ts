import { describe, expect, it } from "vitest";
import { GET as listSnapshots, POST as issueSnapshot } from "@/app/api/projects/[id]/snapshots/route";
import { GET as snapshotReport } from "@/app/api/projects/[id]/snapshots/[sid]/report/route";
import { POST as signoff } from "@/app/api/projects/[id]/snapshots/[sid]/signoff/route";
import { addMember, json, makeProject, makeUser, params, prisma, request, type TestUser } from "./helpers";
import { signInAs } from "./session";

interface Summary {
  id: string;
  version: number;
  status: string;
  requirement: string;
  awaiting: string[];
  superseded: boolean;
  signoffs: { side: string; decision: string }[];
}

const issue = async (projectId: string, note?: string) =>
  issueSnapshot(request("POST", `/api/projects/${projectId}/snapshots`, note ? { note } : {}), params({ id: projectId }));

const sign = async (projectId: string, sid: string, body: unknown) =>
  signoff(request("POST", `/api/projects/${projectId}/snapshots/${sid}/signoff`, body), params({ id: projectId, sid }));

const issued = async (projectId: string): Promise<Summary> => (await json<{ snapshot: Summary }>(await issue(projectId))).snapshot;

/** A DUAL project: the owner is the assessor, one member is the client. */
async function dualProject() {
  const assessor = await makeUser("assessor");
  const client = await makeUser("client");
  const project = await makeProject(assessor, { policy: "DUAL", complete: true });
  await addMember(project.id, client, "MEMBER", "CLIENT");
  return { assessor, client, project };
}

describe("issuing a snapshot", () => {
  it("is blocked with 409 and the failing checks when the model is not ready", async () => {
    const owner = await makeUser();
    const project = await makeProject(owner); // empty: no boundaries, vectors or findings
    signInAs(owner);
    const res = await issue(project.id);
    expect(res.status).toBe(409);
    const body = await json<{ error: string; checks: { id: string; level: string }[] }>(res);
    expect(body.checks.map((c) => c.id)).toContain("has-boundaries");
    expect(body.checks.every((c) => c.level === "BLOCKER")).toBe(true);
    expect(await prisma.assessmentSnapshot.count({ where: { projectId: project.id } })).toBe(0);
  });

  it("fixes the review requirement from the project's policy at issue time", async () => {
    const owner = await makeUser();
    signInAs(owner);
    const expected = { OFF: ["NONE", "ISSUED"], SINGLE: ["SINGLE", "PENDING"], DUAL: ["DUAL", "PENDING"] } as const;
    for (const [policy, [requirement, status]] of Object.entries(expected)) {
      const project = await makeProject(owner, { policy: policy as "OFF" | "SINGLE" | "DUAL", complete: true });
      const s = await issued(project.id);
      expect([s.requirement, s.status]).toEqual([requirement, status]);
    }
  });

  it("numbers versions and marks older ones superseded", async () => {
    const owner = await makeUser();
    const project = await makeProject(owner, { complete: true });
    signInAs(owner);
    const first = await issued(project.id);
    const second = await issued(project.id);
    expect([first.version, second.version]).toEqual([1, 2]);
    const list = await json<{ snapshots: Summary[] }>(
      await listSnapshots(request("GET", `/api/projects/${project.id}/snapshots`), params({ id: project.id })),
    );
    expect(list.snapshots.map((s) => [s.version, s.superseded])).toEqual([[2, false], [1, true]]);
  });

  it("rejects a note over 500 characters", async () => {
    const owner = await makeUser();
    const project = await makeProject(owner, { complete: true });
    signInAs(owner);
    expect((await issue(project.id, "x".repeat(501))).status).toBe(400);
  });
});

describe("dual sign-off", () => {
  it("needs one assessor and one client, and each person decides once", async () => {
    const { assessor, client, project } = await dualProject();
    signInAs(assessor);
    const s = await issued(project.id);
    expect(s.awaiting).toEqual(["assessor", "client"]);

    signInAs(client);
    const afterClient = await json<{ snapshot: Summary }>(await sign(project.id, s.id, { decision: "APPROVE" }));
    expect(afterClient.snapshot.status).toBe("PENDING");
    expect(afterClient.snapshot.awaiting).toEqual(["assessor"]);
    expect((await sign(project.id, s.id, { decision: "APPROVE" })).status).toBe(409); // already decided

    signInAs(assessor);
    const done = await json<{ snapshot: Summary }>(await sign(project.id, s.id, { decision: "APPROVE", comment: "ok" }));
    expect(done.snapshot.status).toBe("APPROVED");
    expect(done.snapshot.signoffs.map((x) => x.side).sort()).toEqual(["ASSESSOR", "CLIENT"]);
    expect((await sign(project.id, s.id, { decision: "APPROVE" })).status).toBe(409); // closed
  });

  it("requires a comment to return a snapshot, and a return is final", async () => {
    const { assessor, client, project } = await dualProject();
    signInAs(assessor);
    const s = await issued(project.id);
    signInAs(client);
    expect((await sign(project.id, s.id, { decision: "RETURN" })).status).toBe(400);
    const returned = await json<{ snapshot: Summary }>(
      await sign(project.id, s.id, { decision: "RETURN", comment: "Scope is incomplete" }),
    );
    expect(returned.snapshot.status).toBe("RETURNED");
    signInAs(assessor);
    expect((await sign(project.id, s.id, { decision: "APPROVE" })).status).toBe(409);
  });

  it("does not let a viewer sign", async () => {
    const { assessor, project } = await dualProject();
    const viewer = await makeUser("viewer");
    await addMember(project.id, viewer, "VIEWER", "CLIENT");
    signInAs(assessor);
    const s = await issued(project.id);
    signInAs(viewer);
    expect((await sign(project.id, s.id, { decision: "APPROVE" })).status).toBe(403);
  });
});

describe("single-approver sign-off (four eyes)", () => {
  it("blocks the issuer from approving their own snapshot, and accepts someone else", async () => {
    const owner = await makeUser("owner");
    const reviewer: TestUser = await makeUser("reviewer");
    const project = await makeProject(owner, { policy: "SINGLE", complete: true });
    await addMember(project.id, reviewer, "MEMBER", "ASSESSOR");
    signInAs(owner);
    const s = await issued(project.id);
    const self = await sign(project.id, s.id, { decision: "APPROVE" });
    expect(self.status).toBe(409);
    expect((await json<{ error: string }>(self)).error).toMatch(/different person/i);
    signInAs(reviewer);
    const ok = await json<{ snapshot: Summary }>(await sign(project.id, s.id, { decision: "APPROVE" }));
    expect(ok.snapshot.status).toBe("APPROVED");
  });
});

describe("snapshot integrity and isolation", () => {
  it("stays frozen when the live model changes afterwards", async () => {
    const owner = await makeUser();
    const project = await makeProject(owner, { complete: true });
    signInAs(owner);
    const s = await issued(project.id);
    await prisma.finding.update({ where: { id: project.findingId! }, data: { title: "Renamed after the snapshot" } });

    const frozen = await json<{ findings: { title: string }[] }>(
      await snapshotReport(
        request("GET", `/api/projects/${project.id}/snapshots/${s.id}/report?format=json`),
        params({ id: project.id, sid: s.id }),
      ),
    );
    expect(frozen.findings[0].title).toBe("Tool schemas are not pinned");
  });

  it("flags a stored snapshot that no longer matches its hash", async () => {
    const owner = await makeUser();
    const project = await makeProject(owner, { complete: true, name: "Original Name" });
    signInAs(owner);
    const s = await issued(project.id);
    const row = await prisma.assessmentSnapshot.findUniqueOrThrow({ where: { id: s.id } });
    await prisma.assessmentSnapshot.update({
      where: { id: s.id },
      data: { assessment: row.assessment.replace("Original Name", "TAMPERED") },
    });
    const md = await (
      await snapshotReport(
        request("GET", `/api/projects/${project.id}/snapshots/${s.id}/report?format=md`),
        params({ id: project.id, sid: s.id }),
      )
    ).text();
    expect(md).toContain("Integrity check failed");
  });

  it("cannot be reached through another project's id", async () => {
    const owner = await makeUser();
    const a = await makeProject(owner, { complete: true });
    const b = await makeProject(owner, { complete: true });
    signInAs(owner);
    const s = await issued(a.id);
    expect((await sign(b.id, s.id, { decision: "APPROVE" })).status).toBe(404);
    const report = await snapshotReport(
      request("GET", `/api/projects/${b.id}/snapshots/${s.id}/report?format=md`),
      params({ id: b.id, sid: s.id }),
    );
    expect(report.status).toBe(404);
  });

  it("records who issued and who signed in the audit trail", async () => {
    const { assessor, client, project } = await dualProject();
    signInAs(assessor);
    const s = await issued(project.id);
    signInAs(client);
    await sign(project.id, s.id, { decision: "APPROVE" });
    const events = await prisma.auditEvent.findMany({
      where: { projectId: project.id, action: { startsWith: "SNAPSHOT" } },
      orderBy: { createdAt: "asc" },
    });
    expect(events.map((e) => [e.action, e.actorLabel])).toEqual([
      ["SNAPSHOT_ISSUED", assessor.email],
      ["SNAPSHOT_APPROVED", client.email],
    ]);
  });
});
