import { describe, expect, it } from "vitest";
import {
  buildWorklist,
  type WorklistFinding,
  type WorklistProject,
  type WorklistSnapshot,
} from "@/lib/worklist";

const NOW = new Date("2026-11-13T12:00:00Z");
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
const ME = { userId: "me", email: "Me@Example.com" };

function finding(over: Partial<WorklistFinding> = {}): WorklistFinding {
  return {
    id: "f1",
    title: "Webhook URL fetched without allowlist",
    severity: "HIGH",
    status: "OPEN",
    owner: "me@example.com",
    dueDate: null,
    reviewDueAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    acceptance: null,
    ...over,
  };
}

function project(over: Partial<WorklistProject> = {}): WorklistProject {
  return {
    id: "p1",
    name: "Payments",
    ownerId: "owner",
    status: "ACTIVE",
    members: [{ userId: "me", email: "me@example.com", role: "MEMBER", side: "CLIENT" }],
    findings: [],
    snapshots: [],
    ...over,
  };
}

const kinds = (items: { kind: string }[]) => items.map((i) => i.kind);

describe("finding deadlines", () => {
  it("flags overdue findings owned by the viewer, matching email case-insensitively", () => {
    const items = buildWorklist(
      [project({ findings: [finding({ dueDate: new Date("2026-11-08T12:00:00Z") })] })],
      ME,
      NOW,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "FINDING_OVERDUE:f1",
      kind: "FINDING_OVERDUE",
      priority: 1,
      title: "F-001 Webhook URL fetched without allowlist",
      detail: "Due 2026-11-08, 5 days overdue",
      href: "/projects/p1/findings",
      projectName: "Payments",
    });
  });
  it("uses the singular for one day", () => {
    const [i] = buildWorklist([project({ findings: [finding({ dueDate: day(-1) })] })], ME, NOW);
    expect(i.detail).toBe("Due 2026-11-12, 1 day overdue");
  });
  it("flags findings due within 14 days as p2", () => {
    const items = buildWorklist(
      [
        project({
          findings: [finding({ dueDate: day(5) }), finding({ id: "f2", dueDate: day(15) })],
        }),
      ],
      ME,
      NOW,
    );
    expect(items.map((i) => i.id)).toEqual(["FINDING_DUE_SOON:f1"]);
    expect(items[0]).toMatchObject({ priority: 2, detail: "Due 2026-11-18, in 5 days" });
  });
  it("ignores resolved findings and other people's findings", () => {
    const items = buildWorklist(
      [
        project({
          findings: [
            finding({ id: "a", status: "CLOSED", dueDate: day(-3) }),
            finding({ id: "b", owner: "other@example.com", dueDate: day(-3) }),
            finding({ id: "c", dueDate: null }),
          ],
        }),
      ],
      ME,
      NOW,
    );
    expect(kinds(items)).toEqual([]);
  });
  it("labels findings by creation order", () => {
    const items = buildWorklist(
      [
        project({
          findings: [
            finding({
              id: "late",
              title: "Later",
              dueDate: day(-1),
              createdAt: new Date("2026-02-01T00:00:00Z"),
            }),
            finding({
              id: "early",
              title: "Earlier",
              owner: "x",
              createdAt: new Date("2026-01-01T00:00:00Z"),
            }),
          ],
        }),
      ],
      ME,
      NOW,
    );
    expect(items[0].title).toBe("F-002 Later");
  });
});

describe("unowned findings", () => {
  it("is one aggregated p3 item per project", () => {
    const items = buildWorklist(
      [
        project({
          ownerId: "me",
          members: [],
          findings: [
            finding({ id: "a", owner: "" }),
            finding({ id: "b", owner: " " }),
            finding({ id: "c", owner: "", status: "MITIGATED" }),
          ],
        }),
      ],
      ME,
      NOW,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "FINDING_UNOWNED:p1",
      kind: "FINDING_UNOWNED",
      priority: 3,
      dueDate: null,
    });
    expect(items[0].title).toBe("2 open findings with no owner");
  });
  it("uses the singular", () => {
    const [i] = buildWorklist([project({ findings: [finding({ owner: "" })] })], ME, NOW);
    expect(i.title).toBe("1 open finding with no owner");
  });
});

describe("acceptance requests", () => {
  const pending = (over = {}) => ({
    status: "PENDING",
    requireBothSides: false,
    requestedById: "owner",
    assessorApprovedAt: null,
    clientApprovedAt: null,
    ...over,
  });
  const withAcc = (acc: WorklistFinding["acceptance"], over: Partial<WorklistProject> = {}) =>
    project({ findings: [finding({ status: "PENDING_ACCEPTANCE", acceptance: acc })], ...over });

  it("SINGLE: any other party may approve", () => {
    const items = buildWorklist([withAcc(pending())], ME, NOW);
    expect(items.map((i) => i.id)).toEqual(["ACCEPTANCE_AWAITING_ME:f1"]);
    expect(items[0].priority).toBe(1);
  });
  it("SINGLE: the requester cannot approve their own request", () => {
    expect(buildWorklist([withAcc(pending({ requestedById: "me" }))], ME, NOW)).toEqual([]);
  });
  it("SINGLE: nothing left once approved", () => {
    expect(buildWorklist([withAcc(pending({ clientApprovedAt: day(-1) }))], ME, NOW)).toEqual([]);
  });
  it("DUAL: the client sees it until the client slot is filled", () => {
    expect(
      buildWorklist(
        [withAcc(pending({ requireBothSides: true, assessorApprovedAt: day(-1) }))],
        ME,
        NOW,
      ),
    ).toHaveLength(1);
    expect(
      buildWorklist(
        [withAcc(pending({ requireBothSides: true, clientApprovedAt: day(-1) }))],
        ME,
        NOW,
      ),
    ).toEqual([]);
  });
  it("DUAL: the assessor side is tracked separately", () => {
    const p = withAcc(
      pending({ requireBothSides: true, clientApprovedAt: day(-1), requestedById: "me" }),
      {
        members: [{ userId: "me", email: "me@example.com", role: "MEMBER", side: "ASSESSOR" }],
      },
    );
    expect(buildWorklist([p], ME, NOW)).toHaveLength(1);
  });
  it("ignores decided requests", () => {
    expect(buildWorklist([withAcc(pending({ status: "APPROVED" }))], ME, NOW)).toEqual([]);
  });
});

describe("expiring acceptances", () => {
  const accepted = (over: Partial<WorklistFinding> = {}) =>
    finding({ status: "ACCEPTED", reviewDueAt: day(10), ...over });
  it("goes to the finding owner", () => {
    const items = buildWorklist([project({ findings: [accepted()] })], ME, NOW);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: "ACCEPTANCE_EXPIRING",
      priority: 2,
      detail: "Acceptance review due 2026-11-23, in 10 days",
    });
  });
  it("goes to the project owner", () => {
    const items = buildWorklist(
      [
        project({
          ownerId: "me",
          members: [],
          findings: [accepted({ owner: "other@example.com" })],
        }),
      ],
      ME,
      NOW,
    );
    expect(kinds(items)).toEqual(["ACCEPTANCE_EXPIRING"]);
  });
  it("skips other members and reviews beyond 30 days", () => {
    expect(
      buildWorklist([project({ findings: [accepted({ owner: "other@example.com" })] })], ME, NOW),
    ).toEqual([]);
    expect(
      buildWorklist([project({ findings: [accepted({ reviewDueAt: day(31) })] })], ME, NOW),
    ).toEqual([]);
  });
});

describe("snapshots", () => {
  const snap = (over: Partial<WorklistSnapshot> = {}): WorklistSnapshot => ({
    id: "s1",
    version: 1,
    requirement: "SINGLE",
    createdById: "owner",
    signoffs: [],
    ...over,
  });
  it("awaiting me: SINGLE, issued by someone else", () => {
    const items = buildWorklist([project({ snapshots: [snap()] })], ME, NOW);
    expect(items[0]).toMatchObject({
      id: "SNAPSHOT_AWAITING_ME:s1",
      priority: 1,
      href: "/projects/p1/review",
    });
  });
  it("the issuer cannot sign a SINGLE snapshot", () => {
    expect(buildWorklist([project({ snapshots: [snap({ createdById: "me" })] })], ME, NOW)).toEqual(
      [],
    );
  });
  it("DUAL: only the side still needed is asked", () => {
    const s = snap({
      requirement: "DUAL",
      signoffs: [{ side: "CLIENT", decision: "APPROVED", userId: "c" }],
    });
    expect(buildWorklist([project({ snapshots: [s] })], ME, NOW)).toEqual([]);
    const s2 = snap({
      requirement: "DUAL",
      signoffs: [{ side: "ASSESSOR", decision: "APPROVED", userId: "a" }],
    });
    expect(kinds(buildWorklist([project({ snapshots: [s2] })], ME, NOW))).toEqual([
      "SNAPSHOT_AWAITING_ME",
    ]);
  });
  it("only the latest snapshot counts", () => {
    const old = snap({ id: "old", version: 1 });
    const latest = snap({ id: "new", version: 2, requirement: "NONE" });
    expect(buildWorklist([project({ snapshots: [old, latest] })], ME, NOW)).toEqual([]);
  });
  it("returned: shown to the issuer only", () => {
    const returned = snap({
      createdById: "me",
      signoffs: [{ side: "CLIENT", decision: "RETURNED", userId: "c" }],
    });
    const items = buildWorklist([project({ snapshots: [returned] })], ME, NOW);
    expect(items.map((i) => i.id)).toEqual(["SNAPSHOT_RETURNED:s1"]);
    expect(
      buildWorklist([project({ snapshots: [{ ...returned, createdById: "owner" }] })], ME, NOW),
    ).toEqual([]);
  });
});

describe("access and exclusions", () => {
  const busy = (over: Partial<WorklistProject> = {}) =>
    project({
      findings: [finding({ dueDate: day(-2) }), finding({ id: "u", owner: "" })],
      snapshots: [
        { id: "s1", version: 1, requirement: "SINGLE", createdById: "owner", signoffs: [] },
      ],
      ...over,
    });
  it("excludes viewer-role members entirely", () => {
    const p = busy({
      members: [{ userId: "me", email: "me@example.com", role: "VIEWER", side: "CLIENT" }],
    });
    expect(buildWorklist([p], ME, NOW)).toEqual([]);
  });
  it("excludes archived projects", () => {
    expect(buildWorklist([busy({ status: "ARCHIVED" })], ME, NOW)).toEqual([]);
  });
  it("excludes projects the viewer has no part in", () => {
    expect(buildWorklist([busy({ members: [] })], ME, NOW)).toEqual([]);
  });
  it("matches a member by email when the invite has no user yet", () => {
    const p = busy({
      members: [{ userId: null, email: "ME@example.com", role: "MEMBER", side: "CLIENT" }],
    });
    expect(buildWorklist([p], ME, NOW).length).toBeGreaterThan(0);
  });
});

describe("ordering", () => {
  it("sorts by priority, then due date with nulls last, then title", () => {
    const p = project({
      ownerId: "me",
      findings: [
        finding({ id: "a", title: "Zeta", dueDate: day(-1) }),
        finding({ id: "b", title: "Alpha", dueDate: day(-3) }),
        finding({ id: "c", title: "Soon", dueDate: day(2) }),
        finding({ id: "d", title: "Nobody", owner: "" }),
      ],
      snapshots: [
        { id: "s1", version: 1, requirement: "SINGLE", createdById: "owner", signoffs: [] },
      ],
    });
    const items = buildWorklist([p], ME, NOW);
    expect(items.map((i) => i.id)).toEqual([
      "FINDING_OVERDUE:b",
      "FINDING_OVERDUE:a",
      "SNAPSHOT_AWAITING_ME:s1",
      "FINDING_DUE_SOON:c",
      "FINDING_UNOWNED:p1",
    ]);
  });
  it("uses no em dashes", () => {
    const p = project({ findings: [finding({ dueDate: day(-1) })] });
    for (const i of buildWorklist([p], ME, NOW)) expect(`${i.title}${i.detail}`).not.toContain("—");
  });
});
