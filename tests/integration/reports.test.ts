import { describe, expect, it } from "vitest";
import { GET as report } from "@/app/api/projects/[id]/report/route";
import { json, makeProject, makeUser, params, request } from "./helpers";
import { signInAs } from "./session";

const get = (id: string, query: string) =>
  report(request("GET", `/api/projects/${id}/report${query}`), params({ id }));

describe("live report export", () => {
  it("serves every format with the right content type and safety headers", async () => {
    const owner = await makeUser();
    const project = await makeProject(owner, { complete: true });
    signInAs(owner);
    const expected: Record<string, string> = {
      md: "text/markdown",
      html: "text/html",
      json: "application/json",
      csv: "text/csv",
    };
    for (const [format, type] of Object.entries(expected)) {
      const res = await get(project.id, `?format=${format}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain(type);
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("cache-control")).toContain("no-store");
    }
  });

  it("defaults to Markdown and rejects an unknown format with a useful message", async () => {
    const owner = await makeUser();
    const project = await makeProject(owner, { complete: true });
    signInAs(owner);
    expect((await get(project.id, "")).headers.get("content-type")).toContain("text/markdown");
    const bad = await get(project.id, "?format=pdf");
    expect(bad.status).toBe(400);
    expect((await json<{ error: string }>(bad)).error).toMatch(/md, html, json, csv/);
  });

  it("serves HTML under a restrictive content security policy", async () => {
    const owner = await makeUser();
    const project = await makeProject(owner, { complete: true });
    signInAs(owner);
    const res = await get(project.id, "?format=html");
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toContain("script-src");
  });

  it("names the download after the project and the date", async () => {
    const owner = await makeUser();
    const project = await makeProject(owner, { complete: true, name: "Payments / Core (v2)" });
    signInAs(owner);
    const disposition = (await get(project.id, "?format=csv&download=1")).headers.get("content-disposition") ?? "";
    expect(disposition).toMatch(/^attachment; filename="payments-core-v2-threat-model-\d{4}-\d{2}-\d{2}\.csv"$/);
  });

  it("returns the full assessment as JSON with a schema version and no attachment contents", async () => {
    const owner = await makeUser();
    const project = await makeProject(owner, { complete: true });
    signInAs(owner);
    const body = await json<{ schemaVersion: string; findings: { id: string }[]; snapshot: unknown }>(
      await get(project.id, "?format=json"),
    );
    expect(body.schemaVersion).toBe("1.0");
    expect(body.findings.map((f) => f.id)).toEqual(["F-001"]);
    expect(body.snapshot).toBeNull(); // a live report is not a snapshot
  });

  it("is unavailable to outsiders (404) and signed-out users (401)", async () => {
    const owner = await makeUser();
    const outsider = await makeUser("outsider");
    const project = await makeProject(owner, { complete: true });
    signInAs(outsider);
    expect((await get(project.id, "?format=md")).status).toBe(404);
    signInAs(null);
    expect((await get(project.id, "?format=md")).status).toBe(401);
  });
});
