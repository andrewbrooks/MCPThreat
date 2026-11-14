import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/cron/reminders/route";
import { json, makeProject, makeUser, prisma, request } from "./helpers";

const SECRET = "integration-test-cron-secret-0123456789";
const URL_PATH = "/api/cron/reminders";
const bearer = (value: string) => ({ authorization: `Bearer ${value}` });

let previous: string | undefined;
beforeEach(() => {
  previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = SECRET;
});
afterEach(() => {
  if (previous === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = previous;
});

describe("reminders endpoint authentication", () => {
  it("is disabled (503) when no secret is configured, even with a header", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(request("GET", URL_PATH, undefined, bearer("anything")))).status).toBe(503);
  });

  it("rejects missing, wrong, different-length and empty credentials with 401", async () => {
    const cases: Record<string, string>[] = [
      {},
      bearer("wrong"),
      bearer(SECRET + "extra"),
      bearer(""),
      { authorization: `Basic ${SECRET}` },
    ];
    for (const headers of cases) {
      expect((await GET(request("GET", URL_PATH, undefined, headers))).status).toBe(401);
    }
  });

  it("does not accept the secret in the query string", async () => {
    expect((await GET(request("GET", `${URL_PATH}?secret=${SECRET}`))).status).toBe(401);
  });

  it("accepts the correct bearer secret on GET and POST", async () => {
    expect((await GET(request("GET", URL_PATH, undefined, bearer(SECRET)))).status).toBe(200);
    expect((await POST(request("POST", URL_PATH, undefined, bearer(SECRET)))).status).toBe(200);
  });
});

describe("reminders endpoint behaviour", () => {
  it("processes a due reminder, schedules the next one, and records it in the audit trail", async () => {
    const owner = await makeUser();
    const project = await makeProject(owner, { complete: true });
    const past = new Date("2020-01-01T00:00:00.000Z");
    await prisma.finding.update({
      where: { id: project.findingId! },
      data: { status: "OPEN", owner: owner.email, reminderIntervalDays: 7, reminderNextAt: past },
    });

    const res = await GET(request("GET", URL_PATH, undefined, bearer(SECRET)));
    const body = await json<{ processed: number; sent: number; skipped: number }>(res);
    expect(body.processed).toBeGreaterThanOrEqual(1);

    const after = await prisma.finding.findUniqueOrThrow({ where: { id: project.findingId! } });
    expect(after.reminderNextAt!.getTime()).toBeGreaterThan(Date.now());
    const audit = await prisma.auditEvent.count({
      where: { projectId: project.id, action: "REMINDER_SENT" },
    });
    expect(audit).toBe(1);
  });

  it("does not remind about findings that are no longer open", async () => {
    const owner = await makeUser();
    const project = await makeProject(owner, { complete: true });
    await prisma.finding.update({
      where: { id: project.findingId! },
      data: {
        status: "CLOSED",
        owner: owner.email,
        reminderIntervalDays: 7,
        reminderNextAt: new Date("2020-01-01T00:00:00.000Z"),
      },
    });
    await GET(request("GET", URL_PATH, undefined, bearer(SECRET)));
    expect(
      await prisma.auditEvent.count({ where: { projectId: project.id, action: "REMINDER_SENT" } }),
    ).toBe(0);
  });
});
