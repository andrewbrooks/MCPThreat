import { describe, expect, it } from "vitest";
import { analysisResultSchema } from "@/lib/analysis/analyze";
import { buildAssessment, type AssessmentInput } from "@/lib/assessment";
import { parseDataflow } from "@/lib/dataflow";
import { generateCsv } from "@/lib/report-csv";
import { generateHtml } from "@/lib/report-html";
import { generateReport } from "@/lib/report-markdown";
import { assessmentContentHash, assessmentModelHash } from "@/lib/snapshot";
import analysisJson from "./fixtures/analysis-response.json";
import assessmentJson from "./fixtures/assessment-input.json";
import dataflowJson from "./fixtures/dataflow.json";

// Realistic sample data lives in tests/fixtures/. These tests keep the samples valid and
// use them to check behaviour that is easy to get wrong with toy inputs.

const GENERATED_AT = new Date("2026-03-10T12:00:00.000Z");
const input = assessmentJson as unknown as AssessmentInput;

describe("dataflow fixture", () => {
  const df = parseDataflow(JSON.stringify(dataflowJson));

  it("parses with the production schema", () => {
    expect(df).not.toBeNull();
    expect(df!.nodes).toHaveLength(5);
    expect(df!.edges).toHaveLength(4);
  });

  it("only connects nodes that exist", () => {
    const ids = new Set(df!.nodes.map((n) => n.id));
    for (const e of df!.edges) {
      expect(ids.has(e.from)).toBe(true);
      expect(ids.has(e.to)).toBe(true);
    }
  });

  it("marks the agent and webhook edges as crossing a trust boundary", () => {
    expect(df!.edges.filter((e) => e.crossesBoundary).map((e) => e.id)).toEqual(["e1", "e4"]);
  });
});

describe("analysis response fixture", () => {
  const parsed = analysisResultSchema.safeParse(analysisJson);

  it("satisfies the schema the analysis tool is asked to produce", () => {
    expect(parsed.success).toBe(true);
  });

  it("references only boundaries and vectors it defines", () => {
    if (!parsed.success) throw new Error("fixture invalid");
    const boundaries = new Set(parsed.data.boundaries.map((b) => b.label));
    const vectors = new Set(parsed.data.vectors.map((v) => v.title));
    for (const v of parsed.data.vectors) expect(boundaries.has(v.boundaryLabel)).toBe(true);
    for (const f of parsed.data.findings) expect(vectors.has(f.vectorTitle)).toBe(true);
  });

  it("rejects a response with an unknown category instead of storing it", () => {
    const bad = structuredClone(analysisJson) as { vectors: { mcpCategory: string }[] };
    bad.vectors[0].mcpCategory = "NOT_A_CATEGORY";
    expect(analysisResultSchema.safeParse(bad).success).toBe(false);
  });
});

describe("assessment fixture", () => {
  const a = buildAssessment(input, GENERATED_AT);

  it("numbers items by creation order", () => {
    expect(a.findings.map((f) => [f.id, f.uid])).toEqual([["F-001", "f1"], ["F-002", "f2"], ["F-003", "f3"]]);
    expect(a.vectors.map((v) => v.id)).toEqual(["T-01", "T-02", "T-03"]);
    expect(a.boundaries.map((b) => b.id)).toEqual(["B-01", "B-02"]);
  });

  it("computes the headline numbers", () => {
    expect(a.summary.openCount).toBe(1); // only f1 is open; f2 accepted, f3 mitigated
    expect(a.summary.completionPct).toBe(33); // one of three vectors has a mitigated finding
    expect(a.record.aiSuggested).toEqual({ boundaries: 0, vectors: 1, findings: 1 });
  });

  it("carries the dual-approval record for the accepted finding", () => {
    const accepted = a.findings.find((f) => f.id === "F-002")!;
    expect(accepted.acceptance?.approvals.map((x) => x.side).sort()).toEqual(["ASSESSOR", "CLIENT"]);
  });

  it("produces a stable content hash that ignores the audit trail and generation time", () => {
    const later = buildAssessment(input, new Date("2027-01-01T00:00:00.000Z"));
    expect(assessmentContentHash(a)).toBe(assessmentContentHash(later));
    const withAudit = buildAssessment(
      { ...input, audit: [{ id: "e1", findingId: "f1", actorLabel: "x", action: "UPDATED", field: null, oldValue: null, newValue: null, detail: null, createdAt: "2026-03-09T00:00:00.000Z" }] },
      GENERATED_AT,
    );
    expect(assessmentModelHash(withAudit)).toBe(assessmentModelHash(a));
    expect(assessmentContentHash(withAudit)).not.toBe(assessmentContentHash(a));
  });
});

describe("hostile tool description in the fixture (a realistic tool-poisoning payload)", () => {
  const a = buildAssessment(input, GENERATED_AT);

  it("never reaches the HTML report as live markup", () => {
    const html = generateHtml(a);
    expect(html).not.toMatch(/<script>alert\(1\)<\/script>/);
    expect(html).not.toMatch(/<IMPORTANT>/i);
    expect(html).not.toMatch(/<img\b/i);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("is neutralised in the Markdown report", () => {
    const md = generateReport(a);
    expect(md).not.toMatch(/(^|[^\\])<IMPORTANT>/);
    expect(md).toContain("\\<IMPORTANT>");
  });

  it("is quoted, not interpreted, in the CSV", () => {
    const csv = generateCsv(a);
    expect(csv).toContain("<script>alert(1)</script>");
    expect(csv.split("\r\n")[0]).toContain("Finding ID");
  });
});
