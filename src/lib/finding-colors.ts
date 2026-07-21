// Shared severity/status → solid color logic for contexts where Tailwind classes
// don't apply (SVG fills, canvas, inline styles). Reused by the trust boundary map
// and the findings table's severity stripe.

export const FINDING_COLORS = {
  redHighCrit: "#E24B4A",
  amberMedium: "#EF9F27",
  blueLowInfo: "#378ADD",
  greenMitigated: "#1D9E75",
} as const;

/**
 * Dot/stripe color for a finding. Mitigated findings are green regardless of
 * severity; otherwise Critical/High → red, Medium → amber, Low/Info → blue.
 */
export function findingColor(severity: string, status: string): string {
  if (status === "MITIGATED") return FINDING_COLORS.greenMitigated;
  if (severity === "CRITICAL" || severity === "HIGH") return FINDING_COLORS.redHighCrit;
  if (severity === "MEDIUM") return FINDING_COLORS.amberMedium;
  return FINDING_COLORS.blueLowInfo; // LOW / INFO
}
