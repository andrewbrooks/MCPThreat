import { describe, expect, it } from "vitest";
import { buildAssessment, type AssessmentInput } from "@/lib/assessment";
import { evaluateReadiness } from "@/lib/readiness";
import type { SnapshotSummary } from "@/lib/workflow-types";

const NOW = new Date("2026-11-13T12:00:00Z");
const T0 = new Date("2026-01-01T10:00:00Z");

type F = AssessmentInput["findings"][number];

function finding(over: Partial<F> = {}): F {
  return {
    id: "f1",
    threatVectorId: "v1",
    title: "Finding",
    description: "Why",
    recommendation: "Fix",
    evidence: "Seen in logs",
    severity: "HIGH",
    status: "MITIGATED",
    source: "MANUAL",
    confidence: null,
    owner: "sec@example.com",
    dueDate: new Date("2026-12-31T00:00:00Z"),
    createdAt: T0,
    updatedAt: T0,
    ...over,
  };
}

/** A project that passes every check apart from sign-off. */
function clean(over: Partial<AssessmentInput> = {}): AssessmentInput {
  return {
    project: {
      id: "p1",
      name: "Demo",
      description: "A payments MCP server",
      mcpServerUrl: "https://mcp.example.com",
      architecture: "",
      status: "ACTIVE",
      acceptancePolicy: "OFF",
      sourceType: "MANUAL",
      repoUrl: null,
      repoRef: null,
      analyzedAt: null,
      techStack: "",
      createdAt: T0,
      updatedAt: T0,
    },
    owner: { name: "Ann", email: "ann@example.com" },
    members: [],
    boundaries: [
      {
        id: "b1",
        label: "Agent to server",
        type: "AGENT_TO_SERVER",
        description: "",
        source: "MANUAL",
        createdAt: T0,
        vectors: [
          {
            id: "v1",
            title: "Poisoned tool",
            description: "",
            strideCategory: "TAMPERING",
            mcpCategory: "TOOL_POISONING",
            likelihood: "HIGH",
            impact: "HIGH",
            source: "MANUAL",
            confidence: null,
            createdAt: T0,
          },
        ],
      },
    ],
    findings: [finding()],
    ...over,
  };
}

const snap = (over: Partial<SnapshotSummary> = {}): SnapshotSummary => ({
  id: "s1",
  version: 1,
  note: "",
  requirement: "NONE",
  status: "ISSUED",
  superseded: false,
  contentHash: "hash-a",
  createdAt: NOW.toISOString(),
  createdBy: "Ann",
  createdById: "u-ann",
  signoffs: [],
  awaiting: [],
  ...over,
});

function run(input: AssessmentInput, snapshots: SnapshotSummary[] = [], liveHash = "hash-a") {
  return evaluateReadiness({
    assessment: buildAssessment(input, NOW),
    snapshots,
    liveHash,
    now: NOW,
  });
}

const get = (r: ReturnType<typeof run>, id: string) =>
  r.stages.flatMap((s) => s.checks).find((c) => c.id === id)!;

describe("check inventory", () => {
  const r = run(clean());
  const all = r.stages.flatMap((s) => s.checks);
  it("returns every check with a unique id, including passed ones", () => {
    expect(all.length).toBe(21);
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
    expect(all.filter((c) => c.passed).every((c) => c.count === 0)).toBe(true);
  });
  it("uses relative hrefs and no em dashes", () => {
    for (const c of all) {
      expect(["", "/model", "/findings", "/architecture", "/review"]).toContain(c.href);
      expect(`${c.title} ${c.detail}`).not.toContain("—");
    }
  });
  it("lists the five stages in order", () => {
    expect(r.stages.map((s) => s.key)).toEqual([
      "SCOPE",
      "MODEL",
      "ASSESS",
      "REMEDIATE",
      "SIGN_OFF",
    ]);
  });
});

describe("empty project", () => {
  const r = run(
    clean({
      project: { ...clean().project, description: "", mcpServerUrl: null },
      boundaries: [],
      findings: [],
    }),
  );
  it("starts at scope and cannot be issued", () => {
    expect(r.currentStage).toBe("SCOPE");
    expect(r.canIssue).toBe(false);
    expect(r.stages.map((s) => s.status)).toEqual([
      "CURRENT",
      "UPCOMING",
      "UPCOMING",
      "UPCOMING",
      "UPCOMING",
    ]);
  });
  it("starts at model once the description is written", () => {
    const r2 = run(clean({ boundaries: [], findings: [] }));
    expect(r2.currentStage).toBe("MODEL");
    expect(get(r2, "has-boundaries").passed).toBe(false);
    expect(get(r2, "has-vectors").passed).toBe(true);
    expect(r2.nextActions[0].id).toBe("has-boundaries");
  });
});

describe("scope checks", () => {
  it("description is a warning, url is only info", () => {
    const r = run(
      clean({ project: { ...clean().project, description: "  ", mcpServerUrl: null } }),
    );
    expect(get(r, "project-description")).toMatchObject({
      level: "WARNING",
      passed: false,
      href: "",
    });
    expect(get(r, "mcp-server-url")).toMatchObject({ level: "INFO", passed: false });
    expect(r.currentStage).toBe("SCOPE");
  });
  it("a missing URL alone does not hold up scope", () => {
    const r = run(clean({ project: { ...clean().project, mcpServerUrl: null } }));
    expect(get(r, "mcp-server-url").passed).toBe(false);
    expect(r.stages[0].status).toBe("DONE");
  });
});

describe("model checks", () => {
  it("has-vectors fails only when a boundary exists", () => {
    const b = clean().boundaries[0];
    const r = run(clean({ boundaries: [{ ...b, vectors: [] }], findings: [] }));
    expect(get(r, "has-vectors")).toMatchObject({ level: "BLOCKER", passed: false });
    expect(get(r, "boundaries-without-vectors")).toMatchObject({ passed: false, count: 1 });
  });
  it("counts boundaries without vectors with correct plurals", () => {
    const b = clean().boundaries[0];
    const empty = (id: string) => ({ ...b, id, vectors: [] });
    const one = run(clean({ boundaries: [b, empty("b2")] }));
    expect(get(one, "boundaries-without-vectors").title).toBe(
      "1 trust boundary has no threat vectors",
    );
    const two = run(clean({ boundaries: [b, empty("b2"), empty("b3")] }));
    expect(get(two, "boundaries-without-vectors").title).toBe(
      "2 trust boundaries have no threat vectors",
    );
  });
  it("reports AI-suggested items as info and passes at zero", () => {
    const b = clean().boundaries[0];
    const ai = run(clean({ boundaries: [{ ...b, source: "AI" }] }));
    expect(get(ai, "ai-suggested-items")).toMatchObject({ level: "INFO", passed: false, count: 1 });
    expect(get(ai, "ai-suggested-items").title).toBe(
      "1 AI-suggested item to confirm before issuing",
    );
    expect(ai.stages[1].status).toBe("DONE");
    expect(get(run(clean()), "ai-suggested-items").passed).toBe(true);
  });
  it("pluralises AI-suggested items", () => {
    const b = clean().boundaries[0];
    const r = run(
      clean({ boundaries: [{ ...b, source: "AI", vectors: [{ ...b.vectors[0], source: "AI" }] }] }),
    );
    expect(get(r, "ai-suggested-items").title).toBe(
      "2 AI-suggested items to confirm before issuing",
    );
  });
});

describe("assess checks", () => {
  it("has-findings is a blocker", () => {
    const r = run(clean({ findings: [] }));
    expect(get(r, "has-findings")).toMatchObject({ level: "BLOCKER", passed: false });
    expect(get(r, "vectors-without-findings").count).toBe(1);
    expect(r.currentStage).toBe("ASSESS");
    expect(r.nextActions[0].id).toBe("has-findings");
  });
  it("vectors without findings", () => {
    const b = clean().boundaries[0];
    const v2 = { ...b.vectors[0], id: "v2" };
    const r = run(clean({ boundaries: [{ ...b, vectors: [b.vectors[0], v2] }] }));
    expect(get(r, "vectors-without-findings").title).toBe(
      "1 threat vector has no finding yet, meaning not assessed",
    );
  });
  it("rationale and recommendation", () => {
    const r = run(
      clean({
        findings: [
          finding({ id: "a", description: "" }),
          finding({ id: "b", description: " ", recommendation: "" }),
        ],
      }),
    );
    expect(get(r, "findings-without-rationale").title).toBe("2 findings have no rationale");
    expect(get(r, "findings-without-recommendation").title).toBe("1 finding has no recommendation");
  });
  it("evidence is only required for Critical and High", () => {
    const r = run(
      clean({
        findings: [
          finding({ id: "a", evidence: "", severity: "CRITICAL" }),
          finding({ id: "b", evidence: "", severity: "LOW" }),
          finding({
            id: "c",
            evidence: "",
            severity: "HIGH",
            attachments: [{ filename: "x.png", mimeType: "image/png", size: 1 }],
          }),
        ],
      }),
    );
    expect(get(r, "high-findings-without-evidence")).toMatchObject({ count: 1, passed: false });
    expect(get(r, "high-findings-without-evidence").title).toBe(
      "1 Critical or High finding has no evidence recorded",
    );
  });
});

describe("remediate checks", () => {
  const open = (o: Partial<F>) => finding({ status: "OPEN", ...o });
  it("owner and due date", () => {
    const r = run(
      clean({
        findings: [
          open({ id: "a", owner: "", dueDate: null }),
          open({ id: "b", owner: " ", dueDate: null, severity: "LOW" }),
          open({ id: "c", owner: "", status: "CLOSED" as string }),
        ],
      }),
    );
    expect(get(r, "open-findings-without-owner").count).toBe(2);
    expect(get(r, "open-findings-without-owner").title).toBe("2 open findings have no owner");
    expect(get(r, "open-high-findings-without-due-date").count).toBe(1);
    expect(r.currentStage).toBe("REMEDIATE");
  });
  it("overdue uses now and ignores resolved findings", () => {
    const r = run(
      clean({
        findings: [
          open({ id: "a", dueDate: new Date("2026-11-12T00:00:00Z") }),
          open({ id: "b", dueDate: new Date("2026-11-14T00:00:00Z") }),
          finding({ id: "c", status: "CLOSED", dueDate: new Date("2026-01-01T00:00:00Z") }),
        ],
      }),
    );
    expect(get(r, "overdue-findings")).toMatchObject({ count: 1, passed: false });
    expect(get(r, "overdue-findings").title).toBe("1 open finding has passed its due date");
  });
  it("info checks do not block the stage", () => {
    const r = run(
      clean({
        findings: [
          open({ id: "a", severity: "CRITICAL" }),
          finding({ id: "b", status: "PENDING_ACCEPTANCE" as string }),
          finding({ id: "c", status: "ACCEPTED", reviewDueAt: new Date("2026-12-01T00:00:00Z") }),
          finding({ id: "d", status: "ACCEPTED", reviewDueAt: new Date("2027-06-01T00:00:00Z") }),
        ],
      }),
    );
    expect(get(r, "open-critical-findings").title).toBe("1 Critical finding is still open");
    expect(get(r, "acceptances-pending")).toMatchObject({ level: "INFO", count: 1 });
    expect(get(r, "acceptances-pending").title).toBe("1 finding is pending acceptance");
    expect(get(r, "acceptances-expiring-soon")).toMatchObject({ level: "INFO", count: 1 });
    expect(r.stages[3].status).toBe("DONE");
    expect(r.currentStage).toBe("SIGN_OFF");
  });
  it("pluralises open Critical findings", () => {
    const r = run(
      clean({
        findings: [
          open({ id: "a", severity: "CRITICAL" }),
          open({ id: "b", severity: "CRITICAL" }),
        ],
      }),
    );
    expect(get(r, "open-critical-findings").title).toBe("2 Critical findings are still open");
  });
});

describe("sign-off checks and stage progression", () => {
  it("no snapshot: sign-off is current", () => {
    const r = run(clean());
    expect(get(r, "snapshot-issued")).toMatchObject({ level: "WARNING", passed: false });
    expect(r.currentStage).toBe("SIGN_OFF");
    expect(r.canIssue).toBe(true);
    expect(r.changedSinceSnapshot).toBeNull();
    expect(r.latestSnapshot).toBeNull();
    expect(r.stages.map((s) => s.status)).toEqual(["DONE", "DONE", "DONE", "DONE", "CURRENT"]);
    expect(r.nextActions.map((c) => c.id)).toEqual(["snapshot-issued"]);
  });
  it("pending snapshot names the sides awaited", () => {
    const r = run(clean(), [
      snap({ status: "PENDING", requirement: "DUAL", awaiting: ["assessor", "client"] }),
    ]);
    expect(get(r, "snapshot-decided").title).toBe(
      "Snapshot v1 is awaiting sign-off from assessor and client",
    );
    expect(r.currentStage).toBe("SIGN_OFF");
  });
  it("returned snapshot is a blocker for the sign-off stage but not for issuing", () => {
    const r = run(clean(), [snap({ status: "RETURNED", requirement: "SINGLE" })]);
    expect(get(r, "snapshot-returned")).toMatchObject({ level: "BLOCKER", passed: false });
    expect(r.nextActions[0].id).toBe("snapshot-returned");
    expect(r.canIssue).toBe(true);
  });
  it("drift is detected against the latest snapshot", () => {
    const r = run(clean(), [snap()], "hash-b");
    expect(r.changedSinceSnapshot).toBe(true);
    expect(get(r, "model-changed-since-snapshot").title).toBe(
      "The model has changed since snapshot v1",
    );
    expect(r.currentStage).toBe("SIGN_OFF");
  });
  it("is complete when the snapshot is decided and unchanged", () => {
    for (const status of ["ISSUED", "APPROVED"] as const) {
      const r = run(clean(), [snap({ status })]);
      expect(r.currentStage).toBe("COMPLETE");
      expect(r.changedSinceSnapshot).toBe(false);
      expect(r.nextActions).toEqual([]);
      expect(r.stages.every((s) => s.status === "DONE")).toBe(true);
    }
  });
  it("only the newest snapshot counts", () => {
    const r = run(clean(), [
      snap({ id: "s2", version: 2, contentHash: "hash-a" }),
      snap({ status: "RETURNED", contentHash: "old" }),
    ]);
    expect(r.latestSnapshot?.id).toBe("s2");
    expect(r.currentStage).toBe("COMPLETE");
  });
  it("an earlier unfinished stage keeps later stages upcoming", () => {
    const r = run(clean({ findings: [finding({ id: "a", status: "OPEN", owner: "" })] }), [snap()]);
    expect(r.currentStage).toBe("REMEDIATE");
    expect(r.stages[4].status).toBe("UPCOMING");
  });
});

describe("canIssue and next actions", () => {
  it("is false with a blocker in an earlier stage", () => {
    expect(run(clean({ findings: [] })).canIssue).toBe(false);
  });
  it("is true with only warnings", () => {
    const r = run(clean({ findings: [finding({ status: "OPEN", owner: "" })] }));
    expect(r.canIssue).toBe(true);
    expect(r.stages[3].outstanding).toBeGreaterThan(0);
  });
  it("orders blockers first, then warnings, then info, capped at five", () => {
    const b = clean().boundaries[0];
    const r = run(
      clean({
        project: { ...clean().project, description: "" },
        boundaries: [],
        findings: [],
      }),
    );
    expect(r.nextActions.map((c) => c.id)).toEqual(["project-description"]);
    const r2 = run(
      clean({
        boundaries: [
          { ...b, source: "AI", vectors: [] },
          { ...b, id: "b2", vectors: [] },
        ],
        findings: [],
      }),
    );
    expect(r2.nextActions.map((c) => c.level)).toEqual(["BLOCKER", "WARNING", "INFO"]);
    expect(r2.nextActions.length).toBeLessThanOrEqual(5);
  });
  it("counts outstanding as failed blockers and warnings only", () => {
    const r = run(clean({ project: { ...clean().project, description: "", mcpServerUrl: null } }));
    expect(r.stages[0].outstanding).toBe(1);
  });
});

describe("drift against the frozen model hash", () => {
  it("compares the live model hash with the snapshot's frozen model hash when given", () => {
    const base = {
      assessment: buildAssessment(clean(), NOW),
      snapshots: [snap({ contentHash: "full-hash" })],
      now: NOW,
    };
    const same = evaluateReadiness({
      ...base,
      liveHash: "model-1",
      latestSnapshotModelHash: "model-1",
    });
    const diff = evaluateReadiness({
      ...base,
      liveHash: "model-2",
      latestSnapshotModelHash: "model-1",
    });
    expect(same.changedSinceSnapshot).toBe(false);
    expect(diff.changedSinceSnapshot).toBe(true);
  });
});
