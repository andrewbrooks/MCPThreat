import {
  count,
  findingsBySeverity,
  SNAPSHOT_STATUS_LABELS,
  type Assessment,
  type AssessmentFinding,
} from "@/lib/assessment";
import { RISK_BAND_LABELS, riskBand, type RiskBand } from "@/lib/risk";
import { RISK_LEVEL_LABELS, SEVERITY_RANK } from "@/lib/taxonomy";

// Derived, Prisma-free data for the report's cover and executive summary. The HTML and
// Markdown renderers both read from this, so they agree on every number. Everything is
// computed from the Assessment alone. Time-based checks are relative to the report's own
// generatedAt, never the clock of whoever is reading it.

export const ATTENTION_LIMIT = 5;
export const REVIEW_WINDOW_DAYS = 30;

const LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
type Level = (typeof LEVELS)[number];
const LEVEL_VALUE: Record<Level, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };

export interface SummaryTile {
  severity: string;
  label: string;
  total: number;
  open: number;
}

export interface StatusSegment {
  status: string;
  label: string;
  count: number;
  /** Share of all findings, 0 to 100, not rounded. */
  pct: number;
}

export interface MatrixCell {
  likelihood: Level;
  impact: Level;
  band: RiskBand;
  bandLabel: string;
  count: number;
}

export interface MatrixRow {
  likelihood: Level;
  likelihoodLabel: string;
  cells: MatrixCell[];
}

export interface ExecutiveSummary {
  headline: string;
  tiles: SummaryTile[];
  /** Statuses worth showing (a zero Pending Acceptance row is hidden when no policy is set). */
  statuses: StatusSegment[];
  findingCount: number;
  matrix: {
    /** Likelihood from High (top) to Low; impact from Low to High (left to right). */
    rows: MatrixRow[];
    impactLabels: { impact: Level; label: string }[];
    vectorCount: number;
  };
  attention: AssessmentFinding[];
  attentionTotal: number;
  observations: string[];
  noObservationsText: string;
  observationsNote: string;
}

export const OBSERVATIONS_NOTE =
  "These observations are checks on the record. They are not an assessment of the system.";
export const NO_OBSERVATIONS_TEXT = "No gaps of these kinds were detected in the record.";

function level(v: string): Level {
  return (LEVELS as readonly string[]).includes(v) ? (v as Level) : "MEDIUM";
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const verb = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Open findings, most severe first, then earliest due date (undated last), then identifier. */
export function attentionOrder(findings: AssessmentFinding[]): AssessmentFinding[] {
  return findingsBySeverity(findings.filter((f) => f.isOpen)).sort(
    (a, b) =>
      (SEVERITY_RANK[b.severity as keyof typeof SEVERITY_RANK] ?? 0) -
        (SEVERITY_RANK[a.severity as keyof typeof SEVERITY_RANK] ?? 0) ||
      (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31") ||
      a.id.localeCompare(b.id),
  );
}

export function executiveSummary(a: Assessment): ExecutiveSummary {
  const s = a.summary;
  const r = a.record;
  const today = a.generatedAt.slice(0, 10);

  // Headline
  const sev = (key: string) => s.bySeverity.find((x) => x.severity === key);
  const standout = [
    { n: sev("CRITICAL")?.open ?? 0, label: "Critical" },
    { n: sev("HIGH")?.open ?? 0, label: "High" },
  ].filter((x) => x.n > 0);
  let openSentence: string;
  if (s.findingCount === 0) openSentence = "No findings have been recorded.";
  else if (s.openCount === 0) openSentence = "No findings are open.";
  else {
    openSentence = `${count(s.openCount, "finding")} ${verb(s.openCount, "is", "are")} open`;
    if (standout.length) openSentence += `, including ${standout.map((x) => `${x.n} ${x.label}`).join(" and ")}`;
    openSentence += ".";
  }
  const headline =
    `${r.projectName} has ${count(s.boundaryCount, "trust boundary", "trust boundaries")}, ` +
    `${count(s.vectorCount, "threat vector")} and ${count(s.findingCount, "finding")}. ${openSentence}`;

  // Statuses
  const statuses: StatusSegment[] = s.byStatus
    .filter((x) => x.count > 0 || x.status !== "PENDING_ACCEPTANCE" || r.acceptancePolicy.value !== "OFF")
    .map((x) => ({
      status: x.status,
      label: x.label,
      count: x.count,
      pct: s.findingCount ? (x.count / s.findingCount) * 100 : 0,
    }));

  // Matrix
  const grid = new Map<string, number>();
  for (const v of a.vectors) {
    const k = `${level(v.likelihood)}:${level(v.impact)}`;
    grid.set(k, (grid.get(k) ?? 0) + 1);
  }
  const likelihoodDesc = [...LEVELS].reverse();
  const rows: MatrixRow[] = likelihoodDesc.map((l) => ({
    likelihood: l,
    likelihoodLabel: RISK_LEVEL_LABELS[l] ?? l,
    cells: LEVELS.map((i) => {
      const band = riskBand(LEVEL_VALUE[l] * LEVEL_VALUE[i]);
      return {
        likelihood: l,
        impact: i,
        band,
        bandLabel: RISK_BAND_LABELS[band],
        count: grid.get(`${l}:${i}`) ?? 0,
      };
    }),
  }));

  // Attention list
  const open = attentionOrder(a.findings);

  // Observations
  const observations: string[] = [];
  const noFinding = a.vectors.filter((v) => v.findingIds.length === 0).length;
  if (noFinding)
    observations.push(`${count(noFinding, "threat vector")} ${verb(noFinding, "has", "have")} no finding.`);
  const noOwner = open.filter((f) => !f.owner.trim()).length;
  if (noOwner)
    observations.push(`${count(noOwner, "open finding")} ${verb(noOwner, "has", "have")} no owner.`);
  const overdue = open.filter((f) => f.dueDate && f.dueDate < today).length;
  if (overdue)
    observations.push(
      `${count(overdue, "open finding")} ${verb(overdue, "is", "are")} past ${verb(overdue, "its", "their")} due date, as at ${today}.`,
    );
  const noEvidence = a.findings.filter(
    (f) =>
      (f.severity === "CRITICAL" || f.severity === "HIGH") && !f.evidence.trim() && f.attachments.length === 0,
  ).length;
  if (noEvidence)
    observations.push(
      `${count(noEvidence, "Critical or High finding")} ${verb(noEvidence, "has", "have")} no evidence recorded.`,
    );
  const ai = r.aiSuggested;
  const aiTotal = ai.boundaries + ai.vectors + ai.findings;
  if (aiTotal)
    observations.push(
      `${count(aiTotal, "AI-suggested item")} (${count(ai.boundaries, "boundary", "boundaries")}, ${count(ai.vectors, "threat vector")}, ${count(ai.findings, "finding")}) ${verb(aiTotal, "has", "have")} not been confirmed by a person.`,
    );
  const horizon = addDays(today, REVIEW_WINDOW_DAYS);
  const reviewSoon = a.findings.filter(
    (f) => f.status === "ACCEPTED" && f.reviewDueAt && f.reviewDueAt >= today && f.reviewDueAt <= horizon,
  ).length;
  if (reviewSoon)
    observations.push(
      `${count(reviewSoon, "accepted risk")} ${verb(reviewSoon, "comes", "come")} up for review within ${REVIEW_WINDOW_DAYS} days.`,
    );

  return {
    headline,
    tiles: s.bySeverity.map((x) => ({ severity: x.severity, label: x.label, total: x.total, open: x.open })),
    statuses,
    findingCount: s.findingCount,
    matrix: {
      rows,
      impactLabels: LEVELS.map((i) => ({ impact: i, label: RISK_LEVEL_LABELS[i] ?? i })),
      vectorCount: s.vectorCount,
    },
    attention: open.slice(0, ATTENTION_LIMIT),
    attentionTotal: open.length,
    observations,
    noObservationsText: NO_OBSERVATIONS_TEXT,
    observationsNote: OBSERVATIONS_NOTE,
  };
}

// ---------------------------------------------------------------------------
// Cover data
// ---------------------------------------------------------------------------

/** "Live draft", or "Snapshot v3, Approved". */
export function statusLine(a: Assessment): string {
  const sn = a.snapshot;
  return sn ? `Snapshot v${sn.version}, ${SNAPSHOT_STATUS_LABELS[sn.status] ?? sn.status}` : "Live draft";
}

/** The snapshot issuer, or for a live report the project owner from the people list. */
export function preparedBy(a: Assessment): string {
  if (a.snapshot) return a.snapshot.issuedBy;
  return a.record.people.find((p) => p.role === "Owner")?.label ?? "";
}
