import { describe, expect, it } from "vitest";
import {
  buildAssessment,
  withSnapshot,
  type AssessmentInput,
  type SnapshotInfo,
} from "@/lib/assessment";
import { generateHtml, reportBodyHtml } from "@/lib/report-html";
import { generateReport } from "@/lib/report-markdown";
import { attentionOrder, executiveSummary, preparedBy, statusLine } from "@/lib/report-summary";

const T0 = new Date("2026-01-01T10:00:00Z");
const GEN = new Date("2026-03-01T12:00:00Z");

type F = AssessmentInput["findings"][number];
type V = AssessmentInput["boundaries"][number]["vectors"][number];

let n = 0;
function vec(over: Partial<V> = {}): V {
  n += 1;
  return {
    id: `v${n}`,
    title: `Vector ${n}`,
    description: "",
    strideCategory: "TAMPERING",
    mcpCategory: "TOOL_POISONING",
    likelihood: "HIGH",
    impact: "HIGH",
    source: "MANUAL",
    confidence: null,
    createdAt: new Date(T0.getTime() + n * 1000),
    ...over,
  };
}
function fnd(vid: string, over: Partial<F> = {}): F {
  n += 1;
  return {
    id: `f${n}`,
    threatVectorId: vid,
    title: `Finding ${n}`,
    description: "d",
    recommendation: "r",
    evidence: "some evidence",
    severity: "MEDIUM",
    status: "OPEN",
    source: "MANUAL",
    confidence: null,
    owner: "sec@example.com",
    dueDate: null,
    createdAt: new Date(T0.getTime() + n * 1000),
    updatedAt: T0,
    ...over,
  };
}

function input(vectors: V[], findings: F[], name = "Demo", policy = "OFF"): AssessmentInput {
  return {
    project: {
      id: "p1",
      name,
      description: "",
      mcpServerUrl: null,
      architecture: "",
      status: "ACTIVE",
      acceptancePolicy: policy,
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
        label: "B",
        type: "AGENT_TO_SERVER",
        description: "",
        source: "MANUAL",
        createdAt: T0,
        vectors,
      },
    ],
    findings,
    audit: [],
  } as unknown as AssessmentInput;
}

const empty = () => buildAssessment(input([], []), GEN);

describe("executiveSummary headline", () => {
  it("uses plural forms and names the most severe open findings", () => {
    const v = [vec(), vec(), vec()];
    const a = buildAssessment(
      input(v, [
        fnd(v[0].id, { severity: "CRITICAL" }),
        fnd(v[1].id, { severity: "HIGH" }),
        fnd(v[1].id, { severity: "HIGH" }),
        fnd(v[2].id, { severity: "LOW", status: "CLOSED" }),
      ]),
      GEN,
    );
    expect(executiveSummary(a).headline).toBe(
      "Demo has 1 trust boundary, 3 threat vectors and 4 findings. 3 findings are open, including 1 Critical and 2 High.",
    );
  });
  it("uses singular forms", () => {
    const v = [vec()];
    const a = buildAssessment(input(v, [fnd(v[0].id, { severity: "LOW" })]), GEN);
    expect(executiveSummary(a).headline).toBe(
      "Demo has 1 trust boundary, 1 threat vector and 1 finding. 1 finding is open.",
    );
  });
  it("handles an empty model", () => {
    expect(executiveSummary(empty()).headline).toBe(
      "Demo has 1 trust boundary, 0 threat vectors and 0 findings. No findings have been recorded.",
    );
  });
});

describe("executiveSummary data", () => {
  const v = [
    vec({ likelihood: "HIGH", impact: "HIGH" }),
    vec({ likelihood: "LOW", impact: "HIGH" }),
    vec({ likelihood: "MEDIUM", impact: "MEDIUM" }),
    vec({ likelihood: "WEIRD", impact: "LOW" }),
  ];
  const a = buildAssessment(
    input(v, [
      fnd(v[0].id, { severity: "HIGH", status: "OPEN" }),
      fnd(v[0].id, { severity: "LOW", status: "IN_PROGRESS" }),
      fnd(v[1].id, { severity: "INFO", status: "MITIGATED" }),
    ]),
    GEN,
  );
  const x = executiveSummary(a);

  it("matrix totals equal the vector count, with band text in each cell", () => {
    const all = x.matrix.rows.flatMap((r) => r.cells);
    expect(all).toHaveLength(9);
    expect(all.reduce((t, c) => t + c.count, 0)).toBe(a.vectors.length);
    expect(x.matrix.rows[0].likelihood).toBe("HIGH");
    expect(all.find((c) => c.likelihood === "HIGH" && c.impact === "HIGH")).toMatchObject({
      band: "CRITICAL",
      bandLabel: "Critical",
      count: 1,
    });
    expect(all.find((c) => c.likelihood === "LOW" && c.impact === "HIGH")?.bandLabel).toBe(
      "Medium",
    );
  });
  it("status segments sum to the finding count", () => {
    expect(x.statuses.reduce((t, s) => t + s.count, 0)).toBe(a.summary.findingCount);
    expect(x.statuses.some((s) => s.status === "PENDING_ACCEPTANCE")).toBe(false);
    expect(x.statuses.reduce((t, s) => t + s.pct, 0)).toBeCloseTo(100);
  });
  it("shows a zero pending-acceptance status only when a policy is active", () => {
    const withPolicy = executiveSummary(buildAssessment(input(v, [], "Demo", "DUAL"), GEN));
    expect(withPolicy.statuses.some((s) => s.status === "PENDING_ACCEPTANCE")).toBe(true);
  });
  it("tiles carry total and open per severity", () => {
    expect(x.tiles.map((t) => [t.label, t.total, t.open])).toEqual([
      ["Critical", 0, 0],
      ["High", 1, 1],
      ["Medium", 0, 0],
      ["Low", 1, 1],
      ["Info", 1, 0],
    ]);
  });
});

describe("attention list", () => {
  it("is open findings only, most severe first, capped at 5", () => {
    const v = [vec()];
    const sevs = ["LOW", "CRITICAL", "MEDIUM", "HIGH", "INFO", "HIGH", "LOW"];
    const fs = sevs.map((severity) => fnd(v[0].id, { severity }));
    fs.push(fnd(v[0].id, { severity: "CRITICAL", status: "CLOSED" }));
    const x = executiveSummary(buildAssessment(input(v, fs), GEN));
    expect(x.attentionTotal).toBe(7);
    expect(x.attention).toHaveLength(5);
    expect(x.attention.map((f) => f.severity)).toEqual([
      "CRITICAL",
      "HIGH",
      "HIGH",
      "MEDIUM",
      "LOW",
    ]);
    expect(x.attention.every((f) => f.isOpen)).toBe(true);
  });
  it("breaks ties by earliest due date, undated last", () => {
    const v = [vec()];
    const a = buildAssessment(
      input(v, [
        fnd(v[0].id, { severity: "HIGH", dueDate: null }),
        fnd(v[0].id, { severity: "HIGH", dueDate: new Date("2026-05-01") }),
        fnd(v[0].id, { severity: "HIGH", dueDate: new Date("2026-04-01") }),
      ]),
      GEN,
    );
    expect(attentionOrder(a.findings).map((f) => f.dueDate)).toEqual([
      "2026-04-01",
      "2026-05-01",
      null,
    ]);
  });
});

describe("key observations", () => {
  it("reports no gaps when none apply", () => {
    const v = [vec()];
    const x = executiveSummary(buildAssessment(input(v, [fnd(v[0].id)]), GEN));
    expect(x.observations).toEqual([]);
    expect(x.noObservationsText).toMatch(/No gaps of these kinds/);
    expect(x.observationsNote).toMatch(/not an assessment of the system/);
  });
  it("shows each observation only when true, with correct plurals", () => {
    const v = [vec(), vec(), vec({ source: "AI", confidence: "LOW" })];
    const a = buildAssessment(
      input(v, [
        fnd(v[0].id, {
          owner: "",
          severity: "CRITICAL",
          evidence: "",
          dueDate: new Date("2026-02-28"),
        }),
        fnd(v[0].id, { owner: " ", dueDate: new Date("2026-03-01") }),
        fnd(v[2].id, { status: "ACCEPTED", reviewDueAt: new Date("2026-03-20") }),
        fnd(v[2].id, { status: "ACCEPTED", reviewDueAt: new Date("2026-05-20") }),
      ]),
      GEN,
    );
    const o = executiveSummary(a).observations;
    expect(o).toContain("1 threat vector has no finding.");
    expect(o).toContain("2 open findings have no owner.");
    expect(o).toContain("1 open finding is past its due date, as at 2026-03-01.");
    expect(o).toContain("1 Critical or High finding has no evidence recorded.");
    expect(
      o.some(
        (t) => t.startsWith("1 AI-suggested item") && t.includes("not been confirmed by a person"),
      ),
    ).toBe(true);
    expect(o).toContain("1 accepted risk comes up for review within 30 days.");
  });
  it("computes overdue from generatedAt, not the viewer's clock", () => {
    const v = [vec()];
    const fs = [fnd(v[0].id, { dueDate: new Date("2026-06-01") })];
    const before = executiveSummary(
      buildAssessment(input(v, fs), new Date("2026-05-31T23:00:00Z")),
    );
    const after = executiveSummary(buildAssessment(input(v, fs), new Date("2026-06-02T01:00:00Z")));
    expect(before.observations.join(" ")).not.toMatch(/past/);
    expect(after.observations.join(" ")).toMatch(/1 open finding is past its due date/);
  });
});

const snapInfo = (over: Partial<SnapshotInfo> = {}): SnapshotInfo => ({
  version: 2,
  issuedAt: "2026-02-01T09:30:00.000Z",
  issuedBy: "ann@example.com",
  note: "",
  contentHash: "ab".repeat(32),
  requirement: "DUAL",
  status: "APPROVED",
  signoffs: [
    {
      userId: "u1",
      side: "ASSESSOR",
      decision: "APPROVED",
      comment: "",
      by: "ann@example.com",
      at: "2026-02-02T09:30:00.000Z",
    },
    {
      userId: "u2",
      side: "CLIENT",
      decision: "APPROVED",
      comment: "<img src=x onerror=1>",
      by: "<b>Cli</b>",
      at: "2026-02-03T09:30:00.000Z",
    },
  ],
  integrity: "VERIFIED",
  ...over,
});

describe("cover and executive summary output", () => {
  const live = buildAssessment(input([vec()], [], "Evil <script>x</script> & Co"), GEN);
  const snap = withSnapshot(live, snapInfo());

  it("status line and preparer", () => {
    expect(statusLine(live)).toBe("Live draft");
    expect(statusLine(snap)).toBe("Snapshot v2, Approved");
    expect(preparedBy(live)).toBe("Ann <ann@example.com>");
    expect(preparedBy(snap)).toBe("ann@example.com");
  });

  it("live html cover states it is not reviewed and has no signature table", () => {
    const html = generateHtml(live);
    expect(html).toContain("Threat model report");
    expect(html).toContain("Live draft");
    expect(html).toContain("Not reviewed. This is a live draft.");
    expect(html).toContain("Date generated");
    expect(html).not.toContain("Content hash");
    expect(html).not.toContain(">Signature<");
  });

  it("snapshot html cover has the full hash, sign-off rows and a signature column", () => {
    const html = generateHtml(snap);
    expect(html).toContain("Snapshot v2, Approved");
    expect(html).toContain("ab".repeat(32));
    expect(html).toContain("Date issued");
    expect(html).toContain(">Signature<");
    expect(html.match(/<td class="sig"><\/td>/g)).toHaveLength(2);
    expect(html).toContain("Prepared by");
  });

  it("escapes hostile names and sign-off values in html and keeps ids stable", () => {
    const html = generateHtml(snap);
    expect(html).not.toContain("<script>x");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>Cli</b>");
    expect(html).toContain("Evil &lt;script&gt;x&lt;/script&gt; &amp; Co");
    expect(html).toContain('id="executive-summary"');
    expect(html).toContain('href="#executive-summary"');
    expect(html).toContain('<h2 id="record">1. Assessment record</h2>');
  });

  it("the executive summary comes after the cover and before the contents", () => {
    const body = reportBodyHtml(live);
    const i = (t: string) => body.indexOf(t);
    expect(i('class="cover"')).toBeGreaterThanOrEqual(0);
    expect(i('class="cover"')).toBeLessThan(i('id="executive-summary"'));
    expect(i('id="executive-summary"')).toBeLessThan(i('aria-label="Contents"'));
  });

  it("html and markdown agree on the numbers", () => {
    const v = [vec(), vec()];
    const a = buildAssessment(input(v, [fnd(v[0].id, { severity: "CRITICAL" })]), GEN);
    const x = executiveSummary(a);
    const html = generateHtml(a);
    const md = generateReport(a);
    expect(html).toContain(x.headline);
    expect(md).toContain(x.headline);
    expect(md).toContain("## Executive summary");
    expect(md).toContain("### Threat vector risk matrix");
    expect(md).toContain("2 (Critical risk)");
    expect(md).toContain("| F-001 | Critical |");
    expect(md).toContain("### Key observations");
  });

  it("markdown cover covers live and snapshot", () => {
    const l = generateReport(live);
    expect(l).toContain("**Live draft**");
    expect(l).toContain("Not reviewed. This is a live draft.");
    expect(l).not.toContain("Content hash");
    const s = generateReport(snap);
    expect(s).toContain("**Snapshot v2, Approved**");
    expect(s).toContain("ab".repeat(32));
    expect(s).toContain("| Party | Decision | Name | Date | Comment | Signature |");
    expect(s).toContain("| Client | Approved |");
    expect(s).toContain("\\<img src=x");
    expect(s).not.toMatch(/(?<!\\)<img/);
  });

  it("contains no em dashes in summary wording", () => {
    const x = executiveSummary(live);
    expect(
      [x.headline, ...x.observations, x.noObservationsText, x.observationsNote].join(" "),
    ).not.toContain("—");
  });

  it("is self-contained", () => {
    expect(generateHtml(snap)).not.toMatch(/<script|<link |\ssrc="|url\(http/i);
  });
});
