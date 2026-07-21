// Single source of truth for the MCPThreat taxonomy: STRIDE categories, MCP-specific
// threat categories, severities, statuses, risk levels, trust-boundary types, and
// project status. Stored as String columns in the DB and validated against these
// values with Zod. Not user-configurable.

export const PROJECT_STATUSES = ["ACTIVE", "ARCHIVED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const TRUST_BOUNDARY_TYPES = [
  "LLM_TO_MCP",
  "MCP_TO_TOOL",
  "MCP_TO_USER",
  "TOOL_OUTPUT_TO_LLM",
  "EXTERNAL",
] as const;
export type TrustBoundaryType = (typeof TRUST_BOUNDARY_TYPES)[number];

export const STRIDE_CATEGORIES = [
  "SPOOFING",
  "TAMPERING",
  "REPUDIATION",
  "INFO_DISCLOSURE",
  "DOS",
  "ELEVATION_OF_PRIVILEGE",
] as const;
export type StrideCategory = (typeof STRIDE_CATEGORIES)[number];

export const MCP_CATEGORIES = [
  "TOOL_POISONING",
  "CONFUSED_DEPUTY",
  "TOKEN_PASSTHROUGH",
  "SSRF",
  "ROGUE_SERVER",
  "PROMPT_INJECTION",
  "SUPPLY_CHAIN",
  "DATA_EXFILTRATION",
  "MULTI_TENANCY",
  "OTHER",
] as const;
export type McpCategory = (typeof MCP_CATEGORIES)[number];

export const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const SEVERITIES = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const FINDING_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "PENDING_ACCEPTANCE",
  "MITIGATED",
  "ACCEPTED",
  "CLOSED",
] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

// Statuses a user may set directly; PENDING_ACCEPTANCE and (under a policy) ACCEPTED
// are managed by the acceptance workflow instead.
export const MANUAL_STATUSES: FindingStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "MITIGATED",
  "ACCEPTED",
  "CLOSED",
];

export const PROJECT_ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const ACCEPTANCE_POLICIES = ["OFF", "SINGLE", "DUAL"] as const;
export type AcceptancePolicy = (typeof ACCEPTANCE_POLICIES)[number];

export const ACCEPTANCE_POLICY_LABELS: Record<AcceptancePolicy, string> = {
  OFF: "Off — accept directly",
  SINGLE: "Single approver",
  DUAL: "Dual sign-off (assessor + client)",
};

export const ACCEPTANCE_POLICY_DESCRIPTIONS: Record<AcceptancePolicy, string> = {
  OFF: "Anyone with edit access can set a finding to Accepted directly.",
  SINGLE: "Accepting requires an approval from someone other than the requester.",
  DUAL: "High/Critical findings require one assessor and one client sign-off; lower severities require a single approver.",
};

// Provenance of a boundary/vector/finding: hand-authored, or suggested by the
// GitHub auto-analysis. AI-suggested items carry a confidence and cited evidence.
export const SOURCES = ["MANUAL", "AI"] as const;
export type Source = (typeof SOURCES)[number];

export const CONFIDENCE_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

// Status of a project's GitHub-driven analysis run.
export const ANALYSIS_STATUSES = ["NONE", "ANALYZING", "READY", "FAILED"] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

// How a project was created: hand-built, or bootstrapped from a GitHub repo.
export const SOURCE_TYPES = ["MANUAL", "GITHUB"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const PARTY_SIDES = ["ASSESSOR", "CLIENT"] as const;
export type PartySide = (typeof PARTY_SIDES)[number];

export const PARTY_SIDE_LABELS: Record<PartySide, string> = {
  ASSESSOR: "Assessor",
  CLIENT: "Client",
};

// A finding counts toward mitigation progress when it reaches one of these states.
export const RESOLVED_STATUSES: FindingStatus[] = ["MITIGATED", "CLOSED"];

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
};

// What each project role can do, surfaced as tooltips in the UI.
export const PROJECT_ROLE_DESCRIPTIONS: Record<ProjectRole, string> = {
  OWNER:
    "Full control. Can edit the project, threat model, and findings, manage members, and delete the project.",
  ADMIN:
    "Can edit the threat model and findings, and invite or remove members. Cannot delete the project.",
  MEMBER:
    "Can edit the threat model and findings. Cannot manage members or delete the project.",
  VIEWER:
    "Read-only. Can view the project, threat model, findings, and reports, but cannot make changes.",
};

// --- Display labels ---------------------------------------------------------

export const TRUST_BOUNDARY_LABELS: Record<TrustBoundaryType, string> = {
  LLM_TO_MCP: "LLM → MCP Server",
  MCP_TO_TOOL: "MCP Server → Tool / Downstream API",
  MCP_TO_USER: "MCP Server → User",
  TOOL_OUTPUT_TO_LLM: "Tool Output → LLM Context",
  EXTERNAL: "External / Third-Party",
};

export const STRIDE_LABELS: Record<StrideCategory, string> = {
  SPOOFING: "Spoofing",
  TAMPERING: "Tampering",
  REPUDIATION: "Repudiation",
  INFO_DISCLOSURE: "Information Disclosure",
  DOS: "Denial of Service",
  ELEVATION_OF_PRIVILEGE: "Elevation of Privilege",
};

export const MCP_CATEGORY_LABELS: Record<McpCategory, string> = {
  TOOL_POISONING: "Tool Poisoning",
  CONFUSED_DEPUTY: "Confused Deputy",
  TOKEN_PASSTHROUGH: "Token Passthrough",
  SSRF: "Server-Side Request Forgery",
  ROGUE_SERVER: "Rogue Server",
  PROMPT_INJECTION: "Prompt Injection",
  SUPPLY_CHAIN: "Supply Chain",
  DATA_EXFILTRATION: "Data Exfiltration",
  MULTI_TENANCY: "Multi-Tenancy / Context Bleed",
  OTHER: "Other",
};

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  INFO: "Info",
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const STATUS_LABELS: Record<FindingStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  PENDING_ACCEPTANCE: "Pending Acceptance",
  MITIGATED: "Mitigated",
  ACCEPTED: "Accepted",
  CLOSED: "Closed",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  ACTIVE: "Active",
  ARCHIVED: "Archived",
};

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  LOW: "Low confidence",
  MEDIUM: "Medium confidence",
  HIGH: "High confidence",
};

// --- Color tokens (Tailwind class fragments) --------------------------------
// Severity: CRITICAL=red, HIGH=orange, MEDIUM=yellow, LOW=blue, INFO=gray.

// Light-first badge palettes with dark-mode variants so they stay legible in both.
export const SEVERITY_BADGE_CLASSES: Record<Severity, string> = {
  CRITICAL:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-400",
  HIGH: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/15 dark:text-orange-400",
  MEDIUM:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-400",
  LOW: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-400",
  INFO: "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-400",
};

export const STATUS_BADGE_CLASSES: Record<FindingStatus, string> = {
  OPEN: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-400",
  IN_PROGRESS:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-400",
  PENDING_ACCEPTANCE:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300",
  MITIGATED:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400",
  ACCEPTED:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-400",
  CLOSED:
    "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-400",
};

export const RISK_LEVEL_CLASSES: Record<RiskLevel, string> = {
  HIGH: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-400",
  MEDIUM:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-400",
  LOW: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-400",
};

export const PROJECT_STATUS_CLASSES: Record<ProjectStatus, string> = {
  ACTIVE:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400",
  ARCHIVED:
    "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-400",
};

// AI-suggested confidence chips — muted so they read as metadata, not severity.
export const CONFIDENCE_BADGE_CLASSES: Record<Confidence, string> = {
  HIGH: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300",
  MEDIUM:
    "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-400",
  LOW: "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-500/20 dark:bg-slate-500/10 dark:text-slate-500",
};

// Severity ordering for sorting (higher = more severe).
export const SEVERITY_RANK: Record<Severity, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

// --- Type guards -------------------------------------------------------------

export const isSeverity = (v: string): v is Severity =>
  (SEVERITIES as readonly string[]).includes(v);
export const isFindingStatus = (v: string): v is FindingStatus =>
  (FINDING_STATUSES as readonly string[]).includes(v);
export const isTrustBoundaryType = (v: string): v is TrustBoundaryType =>
  (TRUST_BOUNDARY_TYPES as readonly string[]).includes(v);
export const isMcpCategory = (v: string): v is McpCategory =>
  (MCP_CATEGORIES as readonly string[]).includes(v);
