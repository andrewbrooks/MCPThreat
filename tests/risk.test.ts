import { describe, expect, it } from "vitest";
import { projectRisk, residualScore, riskBand, riskScore } from "@/lib/risk";

describe("riskScore / riskBand", () => {
  it("multiplies likelihood × impact (1..9)", () => {
    expect(riskScore("LOW", "LOW")).toBe(1);
    expect(riskScore("HIGH", "HIGH")).toBe(9);
    expect(riskScore("MEDIUM", "HIGH")).toBe(6);
  });

  it("defaults unknown levels to MEDIUM(2)", () => {
    expect(riskScore("BOGUS", "HIGH")).toBe(6);
  });

  it("bands the score", () => {
    expect(riskBand(9)).toBe("CRITICAL");
    expect(riskBand(6)).toBe("HIGH");
    expect(riskBand(3)).toBe("MEDIUM");
    expect(riskBand(1)).toBe("LOW");
  });
});

describe("residualScore", () => {
  it("drops a band-worth when resolved, floored at 1", () => {
    expect(residualScore(9, true)).toBe(6);
    expect(residualScore(2, true)).toBe(1);
    expect(residualScore(9, false)).toBe(9);
  });
});

describe("projectRisk", () => {
  it("returns null overall for an empty model", () => {
    expect(projectRisk([]).overall).toBeNull();
  });

  it("reports the highest residual band and per-band counts", () => {
    const { overall, counts } = projectRisk([
      { likelihood: "HIGH", impact: "HIGH", resolved: false }, // 9 -> CRITICAL
      { likelihood: "LOW", impact: "LOW", resolved: false }, // 1 -> LOW
    ]);
    expect(overall).toBe("CRITICAL");
    expect(counts.CRITICAL).toBe(1);
    expect(counts.LOW).toBe(1);
  });

  it("lets mitigation lower the overall band", () => {
    const { overall } = projectRisk([{ likelihood: "HIGH", impact: "HIGH", resolved: true }]);
    expect(overall).toBe("HIGH"); // 9 -> residual 6 -> HIGH
  });
});
