import { describe, expect, it } from "vitest";
import { GET as listSnapshots, POST as issueSnapshot } from "@/app/api/projects/[id]/snapshots/route";
import { addMember, json, makeProject, makeUser, params, request } from "./helpers";
import { signInAs } from "./session";

// Every project-scoped route goes through requireProjectAccess. These tests pin its
// contract using one read route and one write route as probes.

async function world() {
  const owner = await makeUser("owner");
  const admin = await makeUser("admin");
  const member = await makeUser("member");
  const viewer = await makeUser("viewer");
  const outsider = await makeUser("outsider");
  const project = await makeProject(owner, { complete: true });
  await addMember(project.id, admin, "ADMIN", "ASSESSOR");
  await addMember(project.id, member, "MEMBER", "CLIENT");
  await addMember(project.id, viewer, "VIEWER", "CLIENT");
  return { owner, admin, member, viewer, outsider, project };
}

const read = (id: string) => listSnapshots(request("GET", `/api/projects/${id}/snapshots`), params({ id }));
const write = (id: string) => issueSnapshot(request("POST", `/api/projects/${id}/snapshots`, {}), params({ id }));

describe("reading a project", () => {
  it("allows the owner and every member role", async () => {
    const w = await world();
    for (const user of [w.owner, w.admin, w.member, w.viewer]) {
      signInAs(user);
      expect((await read(w.project.id)).status).toBe(200);
    }
  });

  it("returns 401 when nobody is signed in", async () => {
    const w = await world();
    expect((await read(w.project.id)).status).toBe(401);
  });

  it("returns 404 to someone who is not on the project", async () => {
    const w = await world();
    signInAs(w.outsider);
    expect((await read(w.project.id)).status).toBe(404);
  });

  it("does not reveal whether a project exists: outsider and unknown id look identical", async () => {
    const w = await world();
    signInAs(w.outsider);
    const hidden = await read(w.project.id);
    const missing = await read("no-such-project");
    expect(hidden.status).toBe(missing.status);
    expect(await json(hidden)).toEqual(await json(missing));
  });
});

describe("changing a project", () => {
  it("allows the owner, admins and members", async () => {
    const w = await world();
    for (const user of [w.owner, w.admin, w.member]) {
      signInAs(user);
      expect((await write(w.project.id)).status).toBe(201);
    }
  });

  it("forbids a viewer with 403, since they can already see the project", async () => {
    const w = await world();
    signInAs(w.viewer);
    expect((await write(w.project.id)).status).toBe(403);
  });

  it("returns 404 to an outsider and 401 when signed out", async () => {
    const w = await world();
    signInAs(w.outsider);
    expect((await write(w.project.id)).status).toBe(404);
    signInAs(null);
    expect((await write(w.project.id)).status).toBe(401);
  });
});
