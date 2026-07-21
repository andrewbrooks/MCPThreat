// Risk scoring derived from a threat vector's likelihood × impact, plus a residual
// score that drops a band once the vector has a mitigated/closed finding.

const LEVEL_VALUE: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };

export type RiskBand = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export function riskScore(likelihood: string, impact: string): number {
  return (LEVEL_VALUE[likelihood] ?? 2) * (LEVEL_VALUE[impact] ?? 2); // 1..9
}

export function riskBand(score: number): RiskBand {
  if (score >= 9) return "CRITICAL";
  if (score >= 6) return "HIGH";
  if (score >= 3) return "MEDIUM";
  return "LOW";
}

/** Residual score drops ~one band when the vector has been mitigated/closed. */
export function residualScore(inherentScore: number, resolved: boolean): number {
  return resolved ? Math.max(1, inherentScore - 3) : inherentScore;
}

export const RISK_BAND_ORDER: RiskBand[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export const RISK_BAND_LABELS: Record<RiskBand, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

// Light-first with dark variants, matching the severity badge palette.
export const RISK_BAND_CLASSES: Record<RiskBand, string> = {
  CRITICAL:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-400",
  HIGH: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/15 dark:text-orange-400",
  MEDIUM:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-400",
  LOW: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-400",
};

// Heatmap cell fills keyed by band (border + fill + text, tuned for both themes).
export const RISK_BAND_CELL: Record<RiskBand, string> = {
  CRITICAL:
    "border-red-300 bg-red-500/25 text-red-800 dark:border-red-500/40 dark:bg-red-500/25 dark:text-red-200",
  HIGH: "border-orange-300 bg-orange-500/25 text-orange-800 dark:border-orange-500/40 dark:bg-orange-500/25 dark:text-orange-200",
  MEDIUM:
    "border-amber-300 bg-amber-400/30 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/25 dark:text-amber-200",
  LOW: "border-blue-300 bg-blue-500/20 text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/20 dark:text-blue-200",
};

export interface RiskVector {
  likelihood: string;
  impact: string;
  resolved: boolean;
}

/** Highest residual band across the model, plus a count per residual band. */
export function projectRisk(vectors: RiskVector[]): {
  overall: RiskBand | null;
  counts: Record<RiskBand, number>;
} {
  const counts: Record<RiskBand, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  let maxIdx = -1;
  for (const v of vectors) {
    const band = riskBand(residualScore(riskScore(v.likelihood, v.impact), v.resolved));
    counts[band] += 1;
    maxIdx = Math.max(maxIdx, RISK_BAND_ORDER.indexOf(band));
  }
  return { overall: maxIdx >= 0 ? RISK_BAND_ORDER[maxIdx] : null, counts };
}
