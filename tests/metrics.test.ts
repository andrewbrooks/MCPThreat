import { describe, expect, it } from "vitest";
import { completionPct, openFindingCount, openSeverityBreakdown } from "@/lib/metrics";

const f = (status: string, severity: string, threatVectorId = "v1") => ({
  status,
  severity,
  threatVectorId,
});

describe("completionPct", () => {
  it("is 0 with no vectors", () => {
    expect(completionPct([], [f("MITIGATED", "HIGH")])).toBe(0);
  });

  it("counts a vector as covered when it has a mitigated/closed finding", () => {
    const vectors = [{ id: "v1" }, { id: "v2" }];
    const findings = [f("MITIGATED", "HIGH", "v1"), f("OPEN", "LOW", "v2")];
    expect(completionPct(vectors, findings)).toBe(50);
  });

  it("reaches 100 when every vector is resolved", () => {
    const vectors = [{ id: "v1" }, { id: "v2" }];
    const findings = [f("CLOSED", "HIGH", "v1"), f("MITIGATED", "LOW", "v2")];
    expect(completionPct(vectors, findings)).toBe(100);
  });
});

describe("openFindingCount", () => {
  it("counts OPEN and IN_PROGRESS only", () => {
    const findings = [
      f("OPEN", "HIGH"),
      f("IN_PROGRESS", "LOW"),
      f("MITIGATED", "HIGH"),
      f("ACCEPTED", "CRITICAL"),
      f("CLOSED", "LOW"),
    ];
    expect(openFindingCount(findings)).toBe(2);
  });
});

describe("openSeverityBreakdown", () => {
  it("tallies open findings by severity", () => {
    const out = openSeverityBreakdown([
      f("OPEN", "CRITICAL"),
      f("OPEN", "CRITICAL"),
      f("IN_PROGRESS", "HIGH"),
      f("MITIGATED", "HIGH"), // not open — excluded
    ]);
    expect(out.CRITICAL).toBe(2);
    expect(out.HIGH).toBe(1);
    expect(out.MEDIUM).toBe(0);
  });
});
