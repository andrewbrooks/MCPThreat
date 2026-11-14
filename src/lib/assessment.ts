import {
  frameworksForCategories,
  frameworksForCategory,
  type FrameworkItem,
} from "@/lib/frameworks";
import { getKnowledge } from "@/lib/mcp-knowledge-base";
import { completionPct, isOpenStatus, openFindingCount, statusBreakdown } from "@/lib/metrics";
import { RISK_BAND_LABELS, residualScore, riskBand, riskScore, type RiskBand } from "@/lib/risk";
import {
  ACCEPTANCE_POLICY_LABELS,
  MCP_CATEGORY_LABELS,
  PROJECT_STATUS_LABELS,
  RESOLVED_STATUSES,
  RISK_LEVEL_LABELS,
  SEVERITIES,
  SEVERITY_LABELS,
  SEVERITY_RANK,
  STATUS_LABELS,
  STRIDE_LABELS,
  TRUST_BOUNDARY_LABELS,
  type AcceptancePolicy,
  type McpCategory,
} from "@/lib/taxonomy";
import { TOOL_NAME, TOOL_VERSION } from "@/lib/version";
import type {
  SnapshotRequirement,
  SnapshotSignoffView,
  SnapshotStatus,
} from "@/lib/workflow-types";

// The assessment is the single, Prisma-free description of what a report says. The
// on-page report, the Markdown, HTML and CSV exports, and the JSON export are all
// rendered from it, so they cannot drift apart. Everything here is computed at read
// time from the stored model; nothing in this file is persisted.

export const ASSESSMENT_SCHEMA_VERSION = "1.0";

type DateLike = Date | string | null | undefined;

export interface AssessmentInput {
  project: {
    id: string;
    name: string;
    description: string;
    mcpServerUrl: string | null;
    architecture: string;
    status: string;
    acceptancePolicy: string;
    sourceType: string;
    repoUrl: string | null;
    repoRef: string | null;
    analyzedAt: DateLike;
    techStack: string;
    createdAt: DateLike;
    updatedAt: DateLike;
  };
  owner: { name: string | null; email: string } | null;
  members: { email: string; role: string; side: string }[];
  boundaries: {
    id: string;
    label: string;
    type: string;
    description: string;
    source: string;
    createdAt: DateLike;
    vectors: {
      id: string;
      title: string;
      description: string;
      strideCategory: string;
      mcpCategory: string;
      likelihood: string;
      impact: string;
      source: string;
      confidence: string | null;
      createdAt: DateLike;
    }[];
  }[];
  findings: {
    id: string;
    threatVectorId: string;
    title: string;
    description: string;
    recommendation: string;
    evidence: string;
    severity: string;
    status: string;
    source: string;
    confidence: string | null;
    owner: string;
    dueDate: DateLike;
    reviewDueAt?: DateLike;
    createdAt: DateLike;
    updatedAt: DateLike;
    attachments?: { filename: string; mimeType: string; size: number }[];
    acceptanceRequests?: {
      status: string;
      justification: string;
      residualRisk: string;
      requestedByLabel: string;
      assessorApproverLabel: string | null;
      assessorApprovedAt: DateLike;
      clientApproverLabel: string | null;
      clientApprovedAt: DateLike;
      rejectedByLabel: string | null;
      rejectedReason: string | null;
      createdAt: DateLike;
      resolvedAt: DateLike;
      expiresAt: DateLike;
    }[];
  }[];
  audit?: {
    id: string;
    findingId: string | null;
    actorLabel: string;
    action: string;
    field: string | null;
    oldValue: string | null;
    newValue: string | null;
    detail: string | null;
    createdAt: DateLike;
  }[];
}

export interface AssessmentFrameworkRefs {
  owasp: string[];
  atlas: string[];
}

export interface AssessmentAcceptance {
  status: string;
  justification: string;
  residualRisk: string;
  requestedBy: string;
  requestedAt: string | null;
  approvals: { side: "ASSESSOR" | "CLIENT"; by: string; at: string | null }[];
  rejection: { by: string; reason: string } | null;
  resolvedAt: string | null;
  expiresAt: string | null;
}

export interface AssessmentFinding {
  id: string;
  uid: string;
  vectorId: string | null;
  vectorTitle: string | null;
  title: string;
  severity: string;
  severityLabel: string;
  status: string;
  statusLabel: string;
  isOpen: boolean;
  description: string;
  recommendation: string;
  evidence: string;
  owner: string;
  dueDate: string | null;
  reviewDueAt: string | null;
  source: "MANUAL" | "AI";
  confidence: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  mcpCategory: string | null;
  mcpCategoryLabel: string | null;
  frameworks: AssessmentFrameworkRefs;
  attachments: { filename: string; mimeType: string; size: number }[];
  acceptance: AssessmentAcceptance | null;
}

export interface AssessmentVector {
  id: string;
  uid: string;
  boundaryId: string;
  title: string;
  description: string;
  strideCategory: string;
  strideLabel: string;
  mcpCategory: string;
  mcpCategoryLabel: string;
  likelihood: string;
  likelihoodLabel: string;
  impact: string;
  impactLabel: string;
  riskScore: number;
  riskBand: RiskBand;
  residualBand: RiskBand;
  source: "MANUAL" | "AI";
  confidence: string | null;
  frameworks: AssessmentFrameworkRefs;
  findingIds: string[];
}

export interface AssessmentBoundary {
  id: string;
  uid: string;
  label: string;
  type: string;
  typeLabel: string;
  description: string;
  source: "MANUAL" | "AI";
  vectorIds: string[];
}

export interface AssessmentControl {
  category: string;
  categoryLabel: string;
  title: string;
  summary: string;
  mitigations: string[];
  references: { label: string; url: string }[];
}

export interface SnapshotInfo {
  version: number;
  issuedAt: string;
  issuedBy: string;
  note: string;
  contentHash: string;
  requirement: SnapshotRequirement;
  status: SnapshotStatus;
  signoffs: SnapshotSignoffView[];
  /** FAILED when the stored content no longer matches its recorded hash. */
  integrity: "VERIFIED" | "FAILED";
}

export interface Assessment {
  schemaVersion: string;
  tool: { name: string; version: string };
  generatedAt: string;
  /** Null for a live report. Set when the report is rendered from a frozen snapshot. */
  snapshot: SnapshotInfo | null;
  record: {
    projectId: string;
    projectName: string;
    projectDescription: string;
    projectStatus: string;
    projectStatusLabel: string;
    mcpServerUrl: string | null;
    createdAt: string | null;
    lastUpdatedAt: string | null;
    source: {
      type: "MANUAL" | "GITHUB";
      repoUrl: string | null;
      repoRef: string | null;
      analyzedAt: string | null;
      techStack: string[];
    };
    acceptancePolicy: { value: string; label: string };
    people: { label: string; role: string; side: string }[];
    aiSuggested: { boundaries: number; vectors: number; findings: number };
    audit: { eventCount: number; firstEventAt: string | null; lastEventAt: string | null };
  };
  summary: {
    boundaryCount: number;
    vectorCount: number;
    findingCount: number;
    openCount: number;
    completionPct: number;
    bySeverity: { severity: string; label: string; total: number; open: number }[];
    byStatus: { status: string; label: string; count: number }[];
    byRiskBand: { band: RiskBand; label: string; count: number }[];
  };
  scope: { statements: string[]; limitations: string[] };
  definitions: { term: string; text: string }[];
  architecture: string;
  boundaries: AssessmentBoundary[];
  vectors: AssessmentVector[];
  findings: AssessmentFinding[];
  frameworks: {
    note: string;
    owasp: FrameworkItem[];
    atlas: FrameworkItem[];
  };
  controls: AssessmentControl[];
  audit: {
    id: string;
    findingId: string | null;
    at: string | null;
    actor: string;
    action: string;
    field: string | null;
    from: string | null;
    to: string | null;
    detail: string | null;
  }[];
}

// ---------------------------------------------------------------------------
// Wording shared by every export. Kept plain and factual.
// ---------------------------------------------------------------------------

export const FRAMEWORK_NOTE =
  "Mapping only. Each MCP threat category is cross-referenced to the OWASP Top 10 for LLM " +
  "Applications (2025) and MITRE ATLAS. These are indicative references to help locate related " +
  "guidance. They are not a certification, attestation, or assessment of compliance against " +
  "either framework.";

export const LIVE_DRAFT_NOTICE =
  "This is a live draft. It reflects the threat model as it is now and will change as the model is edited. " +
  "A frozen, reviewed record is made from the Review and sign-off page of the project.";

export const REQUIREMENT_LABELS: Record<SnapshotRequirement, string> = {
  NONE: "No sign-off required",
  SINGLE: "One reviewer, other than the issuer",
  DUAL: "Assessor and client",
};

export const SNAPSHOT_STATUS_LABELS: Record<SnapshotStatus, string> = {
  ISSUED: "Issued",
  PENDING: "Awaiting sign-off",
  APPROVED: "Approved",
  RETURNED: "Returned for changes",
};

export const SNAPSHOT_INTEGRITY_TEXT = {
  VERIFIED: "Verified. The stored content matches its recorded hash.",
  FAILED: "Failed. The stored content does not match its recorded hash and may have been altered.",
} as const;

/** Attach (or clear) the snapshot block. Does not change the content hash. */
export function withSnapshot(a: Assessment, info: SnapshotInfo | null): Assessment {
  return { ...a, snapshot: info };
}

export const DEFINITIONS: { term: string; text: string }[] = [
  {
    term: "Open finding",
    text: "A finding whose status is Open, In Progress, or Pending Acceptance. Mitigated, Accepted, and Closed findings are not counted as open.",
  },
  {
    term: "Mitigation completion",
    text: "The share of threat vectors that have at least one finding with status Mitigated or Closed. A vector with no findings does not count as complete. An Accepted finding does not count toward completion.",
  },
  {
    term: "Risk band",
    text: "Derived from the threat vector's likelihood and impact (Low = 1, Medium = 2, High = 3). The product gives a score from 1 to 9: 1 to 2 is Low, 3 to 5 is Medium, 6 to 8 is High, and 9 is Critical.",
  },
  {
    term: "Residual risk band",
    text: "The risk band after reducing the score by 3 (to a minimum of 1) when the vector has at least one Mitigated or Closed finding. It is a simple adjustment, not a re-assessment.",
  },
  {
    term: "Snapshot",
    text: "A frozen copy of the assessment taken at a point in time and given a version number. Its SHA-256 content hash identifies exactly what was assessed, so any later change to the content gives a different hash. The hash is not a digital signature and does not prove who produced it.",
  },
  {
    term: "Severity",
    text: "The assessor's rating of an individual finding (Info, Low, Medium, High, Critical). It is recorded by a person and is not calculated from the risk band.",
  },
  {
    term: "AI-suggested",
    text: "An item drafted by a language model from repository contents during GitHub import. It carries a confidence level (Low, Medium, High) and is intended to be reviewed by a person.",
  },
  {
    term: "Identifiers",
    text: "B-nn (trust boundary), T-nn (threat vector), and F-nnn (finding) are assigned by creation order within the project at the time of export. They are stable while items are only added or edited. Deleting an item renumbers later items of the same kind, so cite the export date and tool version alongside an identifier, or use the internal uid in the JSON export.",
  },
];

export function scopeStatements(): { statements: string[]; limitations: string[] } {
  return {
    statements: [
      "This report describes the threat model recorded in MCPThreat for the project named above: its trust boundaries, threat vectors, findings, and the status of each finding at the time of export.",
      "It records what the assessors entered or reviewed. It does not record what was tested, because MCPThreat does not connect to or test the MCP server.",
    ],
    limitations: [
      "This is a threat model, not a penetration test, code audit, vulnerability scan, or compliance assessment. The absence of a finding does not mean the absence of a weakness.",
      "Coverage depends on the trust boundaries and threat vectors that were modeled. Threats outside the MCP and STRIDE categories used here are recorded under Other, or not at all.",
      "Items marked AI-suggested were drafted by a language model from repository contents. They may be incomplete or wrong, and should be confirmed by a person before they are relied on.",
      "Severity ratings and likelihood and impact levels are judgements entered by people. The risk band is a fixed calculation from those inputs.",
      "Framework mappings are indicative cross-references. They are not a certification or attestation against OWASP, MITRE ATLAS, or any other framework.",
      "Status, ownership, and acceptance decisions reflect what was recorded in MCPThreat. Evidence referenced here has not been independently verified by the tool.",
    ],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function iso(d: DateLike): string | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function day(d: DateLike): string | null {
  const s = iso(d);
  return s ? s.slice(0, 10) : null;
}

function label(map: object, key: string): string {
  return (map as Record<string, string>)[key] ?? key;
}

function ts(d: DateLike): number {
  const s = iso(d);
  return s ? Date.parse(s) : 0;
}

function byCreated<T extends { createdAt: DateLike; id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => ts(a.createdAt) - ts(b.createdAt) || a.id.localeCompare(b.id));
}

/** "1 finding", "2 findings". Pass the plural for irregular nouns, such as boundary / boundaries. */
export function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

const pad = (n: number, width: number) => String(n).padStart(width, "0");
export const boundaryDisplayId = (n: number) => `B-${pad(n, 2)}`;
export const vectorDisplayId = (n: number) => `T-${pad(n, 2)}`;
export const findingDisplayId = (n: number) => `F-${pad(n, 3)}`;

/** Display IDs (F-001...) for a project's findings, by creation order. */
export function findingDisplayIds(
  findings: { id: string; createdAt: DateLike }[],
): Map<string, string> {
  return new Map(byCreated(findings).map((f, i) => [f.id, findingDisplayId(i + 1)]));
}

function asSource(s: string): "MANUAL" | "AI" {
  return s === "AI" ? "AI" : "MANUAL";
}

function refs(category: string): AssessmentFrameworkRefs {
  const f = frameworksForCategory(category as McpCategory);
  return { owasp: f.owasp.map((i) => i.id), atlas: f.atlas.map((i) => i.id) };
}

function toAcceptance(
  reqs: NonNullable<AssessmentInput["findings"][number]["acceptanceRequests"]> | undefined,
): AssessmentAcceptance | null {
  if (!reqs || reqs.length === 0) return null;
  const r = [...reqs].sort((a, b) => ts(b.createdAt) - ts(a.createdAt))[0];
  const approvals: AssessmentAcceptance["approvals"] = [];
  if (r.assessorApproverLabel || r.assessorApprovedAt) {
    approvals.push({
      side: "ASSESSOR",
      by: r.assessorApproverLabel ?? "",
      at: iso(r.assessorApprovedAt),
    });
  }
  if (r.clientApproverLabel || r.clientApprovedAt) {
    approvals.push({
      side: "CLIENT",
      by: r.clientApproverLabel ?? "",
      at: iso(r.clientApprovedAt),
    });
  }
  return {
    status: r.status,
    justification: r.justification,
    residualRisk: r.residualRisk,
    requestedBy: r.requestedByLabel,
    requestedAt: iso(r.createdAt),
    approvals,
    rejection: r.rejectedByLabel ? { by: r.rejectedByLabel, reason: r.rejectedReason ?? "" } : null,
    resolvedAt: iso(r.resolvedAt),
    expiresAt: iso(r.expiresAt),
  };
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

type BoundaryInput = AssessmentInput["boundaries"][number];
type VectorInput = BoundaryInput["vectors"][number];
type FindingInput = AssessmentInput["findings"][number];

/** Display ids (B-nn, T-nn, F-nnn) come from creation order, so they are assigned once and
 *  every later step looks them up by the row's own id. */
interface DisplayIds {
  boundariesSorted: BoundaryInput[];
  vectorsSorted: { v: VectorInput; boundaryUid: string }[];
  findingsSorted: FindingInput[];
  boundaryIdByUid: Map<string, string>;
  vectorIdByUid: Map<string, string>;
  findingIdByUid: Map<string, string>;
}

function assignDisplayIds(input: AssessmentInput): DisplayIds {
  const boundariesSorted = byCreated(input.boundaries);
  const boundaryIdByUid = new Map<string, string>();
  boundariesSorted.forEach((b, i) => boundaryIdByUid.set(b.id, boundaryDisplayId(i + 1)));

  const flatVectors = boundariesSorted.flatMap((b) =>
    byCreated(b.vectors).map((v) => ({ v, boundaryUid: b.id })),
  );
  const vectorsSorted = [...flatVectors].sort(
    (a, b) => ts(a.v.createdAt) - ts(b.v.createdAt) || a.v.id.localeCompare(b.v.id),
  );
  const vectorIdByUid = new Map<string, string>();
  vectorsSorted.forEach(({ v }, i) => vectorIdByUid.set(v.id, vectorDisplayId(i + 1)));

  const findingsSorted = byCreated(input.findings);
  const findingIdByUid = new Map<string, string>();
  findingsSorted.forEach((f, i) => findingIdByUid.set(f.id, findingDisplayId(i + 1)));
  return {
    boundariesSorted,
    vectorsSorted,
    findingsSorted,
    boundaryIdByUid,
    vectorIdByUid,
    findingIdByUid,
  };
}

function buildVectors(input: AssessmentInput, ids: DisplayIds): AssessmentVector[] {
  const { findingsSorted, vectorsSorted, boundaryIdByUid, vectorIdByUid, findingIdByUid } = ids;
  const resolvedVectorUids = new Set(
    input.findings
      .filter((f) => (RESOLVED_STATUSES as string[]).includes(f.status))
      .map((f) => f.threatVectorId),
  );

  const findingIdsByVector = new Map<string, string[]>();
  for (const f of findingsSorted) {
    const list = findingIdsByVector.get(f.threatVectorId) ?? [];
    list.push(findingIdByUid.get(f.id)!);
    findingIdsByVector.set(f.threatVectorId, list);
  }

  return vectorsSorted.map(({ v, boundaryUid }) => {
    const score = riskScore(v.likelihood, v.impact);
    const resolved = resolvedVectorUids.has(v.id);
    return {
      id: vectorIdByUid.get(v.id)!,
      uid: v.id,
      boundaryId: boundaryIdByUid.get(boundaryUid)!,
      title: v.title,
      description: v.description,
      strideCategory: v.strideCategory,
      strideLabel: label(STRIDE_LABELS, v.strideCategory),
      mcpCategory: v.mcpCategory,
      mcpCategoryLabel: label(MCP_CATEGORY_LABELS, v.mcpCategory),
      likelihood: v.likelihood,
      likelihoodLabel: label(RISK_LEVEL_LABELS, v.likelihood),
      impact: v.impact,
      impactLabel: label(RISK_LEVEL_LABELS, v.impact),
      riskScore: score,
      riskBand: riskBand(score),
      residualBand: riskBand(residualScore(score, resolved)),
      source: asSource(v.source),
      confidence: v.source === "AI" ? v.confidence : null,
      frameworks: refs(v.mcpCategory),
      findingIds: findingIdsByVector.get(v.id) ?? [],
    };
  });
}

function buildBoundaries(ids: DisplayIds, vectors: AssessmentVector[]): AssessmentBoundary[] {
  const { boundariesSorted, boundaryIdByUid } = ids;
  const vectorIdsByBoundary = new Map<string, string[]>();
  for (const v of vectors) {
    const list = vectorIdsByBoundary.get(v.boundaryId) ?? [];
    list.push(v.id);
    vectorIdsByBoundary.set(v.boundaryId, list);
  }

  return boundariesSorted.map((b) => ({
    id: boundaryIdByUid.get(b.id)!,
    uid: b.id,
    label: b.label,
    type: b.type,
    typeLabel: label(TRUST_BOUNDARY_LABELS, b.type),
    description: b.description,
    source: asSource(b.source),
    vectorIds: vectorIdsByBoundary.get(boundaryIdByUid.get(b.id)!) ?? [],
  }));
}

function buildFindings(ids: DisplayIds): AssessmentFinding[] {
  const { findingsSorted, vectorsSorted, vectorIdByUid, findingIdByUid } = ids;
  const vectorRecord = new Map(vectorsSorted.map(({ v }) => [v.id, v]));
  return findingsSorted.map((f) => {
    const vec = vectorRecord.get(f.threatVectorId);
    return {
      id: findingIdByUid.get(f.id)!,
      uid: f.id,
      vectorId: vectorIdByUid.get(f.threatVectorId) ?? null,
      vectorTitle: vec?.title ?? null,
      title: f.title,
      severity: f.severity,
      severityLabel: label(SEVERITY_LABELS, f.severity),
      status: f.status,
      statusLabel: label(STATUS_LABELS, f.status),
      isOpen: isOpenStatus(f.status),
      description: f.description,
      recommendation: f.recommendation,
      evidence: f.evidence,
      owner: f.owner,
      dueDate: day(f.dueDate),
      reviewDueAt: day(f.reviewDueAt),
      source: asSource(f.source),
      confidence: f.source === "AI" ? f.confidence : null,
      createdAt: iso(f.createdAt),
      updatedAt: iso(f.updatedAt),
      mcpCategory: vec?.mcpCategory ?? null,
      mcpCategoryLabel: vec ? label(MCP_CATEGORY_LABELS, vec.mcpCategory) : null,
      frameworks: vec ? refs(vec.mcpCategory) : { owasp: [], atlas: [] },
      attachments: (f.attachments ?? []).map((a) => ({
        filename: a.filename,
        mimeType: a.mimeType,
        size: a.size,
      })),
      acceptance: toAcceptance(f.acceptanceRequests),
    };
  });
}

function buildControls(vectors: AssessmentVector[]): AssessmentControl[] {
  const presentCategories = Array.from(new Set(vectors.map((v) => v.mcpCategory)));
  return presentCategories.flatMap((cat) => {
    const kb = getKnowledge(cat as McpCategory);
    if (!kb) return [];
    return [
      {
        category: cat,
        categoryLabel: label(MCP_CATEGORY_LABELS, cat),
        title: kb.title,
        summary: kb.summary,
        mitigations: kb.mitigations,
        references: kb.references,
      },
    ];
  });
}

function buildPeople(input: AssessmentInput): Assessment["record"]["people"] {
  const owner = input.owner;
  const people: Assessment["record"]["people"] = [];
  if (owner) {
    people.push({
      label: owner.name ? `${owner.name} <${owner.email}>` : owner.email,
      role: "Owner",
      side: "ASSESSOR",
    });
  }
  for (const m of input.members) {
    people.push({
      label: m.email,
      role: label({ OWNER: "Owner", ADMIN: "Admin", MEMBER: "Member", VIEWER: "Viewer" }, m.role),
      side: m.side,
    });
  }
  return people;
}

function buildSummary(
  input: AssessmentInput,
  boundaries: AssessmentBoundary[],
  vectors: AssessmentVector[],
  findings: AssessmentFinding[],
): Assessment["summary"] {
  const flatForMetrics = vectors.map((v) => ({ id: v.uid }));
  const statuses = statusBreakdown(input.findings);
  const bandCounts: Record<RiskBand, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  for (const v of vectors) bandCounts[v.riskBand] += 1;
  return {
    boundaryCount: boundaries.length,
    vectorCount: vectors.length,
    findingCount: findings.length,
    openCount: openFindingCount(input.findings),
    completionPct: completionPct(flatForMetrics, input.findings),
    bySeverity: [...SEVERITIES]
      .sort((a, b) => SEVERITY_RANK[b] - SEVERITY_RANK[a])
      .map((s) => ({
        severity: s,
        label: SEVERITY_LABELS[s],
        total: findings.filter((f) => f.severity === s).length,
        open: findings.filter((f) => f.severity === s && f.isOpen).length,
      })),
    byStatus: Object.entries(statuses).map(([status, count]) => ({
      status,
      label: label(STATUS_LABELS, status),
      count,
    })),
    byRiskBand: (["CRITICAL", "HIGH", "MEDIUM", "LOW"] as RiskBand[]).map((band) => ({
      band,
      label: RISK_BAND_LABELS[band],
      count: bandCounts[band],
    })),
  };
}

function buildRecord(
  input: AssessmentInput,
  auditSorted: AssessmentInput["audit"] & object,
  boundaries: AssessmentBoundary[],
  vectors: AssessmentVector[],
  findings: AssessmentFinding[],
): Assessment["record"] {
  const { project } = input;
  const policy = project.acceptancePolicy as AcceptancePolicy;
  return {
    projectId: project.id,
    projectName: project.name,
    projectDescription: project.description,
    projectStatus: project.status,
    projectStatusLabel: label(PROJECT_STATUS_LABELS, project.status),
    mcpServerUrl: project.mcpServerUrl,
    createdAt: iso(project.createdAt),
    lastUpdatedAt: iso(
      [project.updatedAt, ...input.findings.map((f) => f.updatedAt)].sort(
        (a, b) => ts(b) - ts(a),
      )[0],
    ),
    source: {
      type: project.sourceType === "GITHUB" ? "GITHUB" : "MANUAL",
      repoUrl: project.repoUrl,
      repoRef: project.repoRef,
      analyzedAt: iso(project.analyzedAt),
      techStack: project.techStack
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    },
    acceptancePolicy: {
      value: project.acceptancePolicy,
      label: label(ACCEPTANCE_POLICY_LABELS, policy),
    },
    people: buildPeople(input),
    aiSuggested: {
      boundaries: boundaries.filter((b) => b.source === "AI").length,
      vectors: vectors.filter((v) => v.source === "AI").length,
      findings: findings.filter((f) => f.source === "AI").length,
    },
    audit: {
      eventCount: auditSorted.length,
      firstEventAt: iso(auditSorted[0]?.createdAt),
      lastEventAt: iso(auditSorted[auditSorted.length - 1]?.createdAt),
    },
  };
}

export function buildAssessment(input: AssessmentInput, generatedAt = new Date()): Assessment {
  const { project } = input;
  const ids = assignDisplayIds(input);
  const vectors = buildVectors(input, ids);
  const boundaries = buildBoundaries(ids, vectors);
  const findings = buildFindings(ids);

  const fw = frameworksForCategories(Array.from(new Set(vectors.map((v) => v.mcpCategory))));
  const auditSorted = [...(input.audit ?? [])].sort((a, b) => ts(a.createdAt) - ts(b.createdAt));

  return {
    schemaVersion: ASSESSMENT_SCHEMA_VERSION,
    tool: { name: TOOL_NAME, version: TOOL_VERSION },
    generatedAt: generatedAt.toISOString(),
    snapshot: null,
    record: buildRecord(input, auditSorted, boundaries, vectors, findings),
    summary: buildSummary(input, boundaries, vectors, findings),
    scope: scopeStatements(),
    definitions: DEFINITIONS,
    architecture: project.architecture,
    boundaries,
    vectors,
    findings,
    frameworks: { note: FRAMEWORK_NOTE, owasp: fw.owasp, atlas: fw.atlas },
    controls: buildControls(vectors),
    audit: auditSorted.map((e) => ({
      id: e.id,
      findingId: e.findingId ? (ids.findingIdByUid.get(e.findingId) ?? null) : null,
      at: iso(e.createdAt),
      actor: e.actorLabel,
      action: e.action,
      field: e.field,
      from: e.oldValue,
      to: e.newValue,
      detail: e.detail,
    })),
  };
}

/** Findings ordered most severe first, then by identifier, for tables and detail sections. */
export function findingsBySeverity(findings: AssessmentFinding[]): AssessmentFinding[] {
  return [...findings].sort(
    (a, b) =>
      (SEVERITY_RANK[b.severity as keyof typeof SEVERITY_RANK] ?? 0) -
        (SEVERITY_RANK[a.severity as keyof typeof SEVERITY_RANK] ?? 0) || a.id.localeCompare(b.id),
  );
}
