import { describe, expect, it } from "vitest";
import { PATCH } from "@/app/api/projects/[id]/findings/[fid]/route";
import { GET as health } from "@/app/api/health/route";
import { addMember, json, makeProject, makeUser, params, prisma, request } from "./helpers";
import { signInAs } from "./session";

const patch = (projectId: string, fid: string, body: unknown) =>
  PATCH(request("PATCH", `/api/projects/${projectId}/findings/${fid}`, body), params({ id: projectId, fid }));

describe("risk acceptance cannot be bypassed by editing status", () => {
  it("rejects setting ACCEPTED or PENDING_ACCEPTANCE directly when a policy is active", async () => {
    const owner = await makeUser();
    const project = await makeProject(owner, { policy: "DUAL", complete: true });
    signInAs(owner);
    for (const status of ["ACCEPTED", "PENDING_ACCEPTANCE"]) {
      const res = await patch(project.id, project.findingId!, { status });
      expect(res.status).toBe(400);
    }
    expect((await prisma.finding.findUniqueOrThrow({ where: { id: project.findingId! } })).status).toBe("OPEN");
  });

  it("allows ACCEPTED when the policy is off", async () => {
    const owner = await makeUser();
    const project = await makeProject(owner, { policy: "OFF", complete: true });
    signInAs(owner);
    expect((await patch(project.id, project.findingId!, { status: "ACCEPTED" })).status).toBe(200);
  });

  it("still allows ordinary status changes under a policy", async () => {
    const owner = await makeUser();
    const project = await makeProject(owner, { policy: "DUAL", complete: true });
    signInAs(owner);
    expect((await patch(project.id, project.findingId!, { status: "IN_PROGRESS" })).status).toBe(200);
  });
});

describe("finding updates are scoped to the project", () => {
  it("returns 404 for a finding that belongs to another project", async () => {
    const owner = await makeUser();
    const a = await makeProject(owner, { complete: true });
    const b = await makeProject(owner, { complete: true });
    signInAs(owner);
    expect((await patch(b.id, a.findingId!, { status: "CLOSED" })).status).toBe(404);
    expect((await prisma.finding.findUniqueOrThrow({ where: { id: a.findingId! } })).status).toBe("OPEN");
  });

  it("forbids viewers from editing", async () => {
    const owner = await makeUser();
    const viewer = await makeUser("viewer");
    const project = await makeProject(owner, { complete: true });
    await addMember(project.id, viewer, "VIEWER", "CLIENT");
    signInAs(viewer);
    expect((await patch(project.id, project.findingId!, { status: "CLOSED" })).status).toBe(403);
  });

  it("records the change in the audit trail with the actor", async () => {
    const owner = await makeUser();
    const project = await makeProject(owner, { complete: true });
    signInAs(owner);
    await patch(project.id, project.findingId!, { status: "IN_PROGRESS" });
    const event = await prisma.auditEvent.findFirst({
      where: { projectId: project.id, findingId: project.findingId!, action: "STATUS_CHANGED" },
    });
    expect(event?.actorLabel).toBe(owner.email);
    expect([event?.oldValue, event?.newValue]).toEqual(["OPEN", "IN_PROGRESS"]);
  });
});

describe("health check", () => {
  it("reports the database as up", async () => {
    const res = await health();
    expect(res.status).toBe(200);
    expect(await json<{ status: string; db: string }>(res)).toMatchObject({ status: "ok", db: "up" });
  });
});
