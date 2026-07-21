import { z } from "zod";
import {
  ACCEPTANCE_POLICIES,
  CONFIDENCE_LEVELS,
  FINDING_STATUSES,
  MCP_CATEGORIES,
  PARTY_SIDES,
  PROJECT_ROLES,
  PROJECT_STATUSES,
  RISK_LEVELS,
  SEVERITIES,
  SOURCES,
  STRIDE_CATEGORIES,
  TRUST_BOUNDARY_TYPES,
} from "@/lib/taxonomy";

// Enum schemas derived from the single-source-of-truth taxonomy.
export const zProjectStatus = z.enum(PROJECT_STATUSES);
export const zTrustBoundaryType = z.enum(TRUST_BOUNDARY_TYPES);
export const zStride = z.enum(STRIDE_CATEGORIES);
export const zMcpCategory = z.enum(MCP_CATEGORIES);
export const zRisk = z.enum(RISK_LEVELS);
export const zSeverity = z.enum(SEVERITIES);
export const zStatus = z.enum(FINDING_STATUSES);
export const zRole = z.enum(PROJECT_ROLES);
export const zAcceptancePolicy = z.enum(ACCEPTANCE_POLICIES);
export const zPartySide = z.enum(PARTY_SIDES);
export const zSource = z.enum(SOURCES);
export const zConfidence = z.enum(CONFIDENCE_LEVELS);

// --- GitHub auto-analysis import -------------------------------------------
// Repo URL is validated for host (github.com) in src/lib/github.ts; here we only
// bound length/shape. The optional token is used per-request and never persisted.
export const analyzeRepoSchema = z
  .object({
    repoUrl: z.string().trim().min(1, "Repository URL is required").max(2048),
    token: z.string().trim().max(255).optional(),
  })
  .strict();

const optionalUrl = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .or(z.literal(""));

// --- Auth -------------------------------------------------------------------

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120),
    email: z.string().trim().email("Enter a valid email").max(254),
    password: z.string().min(8, "Password must be at least 8 characters").max(200),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().trim().email().max(254),
    password: z.string().min(1),
  })
  .strict();

// --- Project ----------------------------------------------------------------

export const createProjectSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(160),
    description: z.string().max(2000).optional(),
    mcpServerUrl: optionalUrl,
    architecture: z.string().max(20000).optional(),
    status: zProjectStatus.optional(),
  })
  .strict();

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    description: z.string().max(2000).optional(),
    mcpServerUrl: optionalUrl,
    architecture: z.string().max(20000).optional(),
    status: zProjectStatus.optional(),
    acceptancePolicy: zAcceptancePolicy.optional(),
  })
  .strict();

// --- Threat model -----------------------------------------------------------

export const updateThreatModelSchema = z
  .object({ notes: z.string().max(20000) })
  .strict();

// --- Trust boundary ---------------------------------------------------------

export const createBoundarySchema = z
  .object({
    label: z.string().trim().min(1, "Label is required").max(160),
    description: z.string().max(4000).optional().default(""),
    type: zTrustBoundaryType,
  })
  .strict();

export const updateBoundarySchema = z
  .object({
    label: z.string().trim().min(1).max(160).optional(),
    description: z.string().max(4000).optional(),
    type: zTrustBoundaryType.optional(),
  })
  .strict();

// --- Threat vector ----------------------------------------------------------

export const createVectorSchema = z
  .object({
    trustBoundaryId: z.string().min(1),
    title: z.string().trim().min(1, "Title is required").max(200),
    description: z.string().max(4000).optional().default(""),
    strideCategory: zStride,
    mcpCategory: zMcpCategory,
    likelihood: zRisk.optional().default("MEDIUM"),
    impact: zRisk.optional().default("MEDIUM"),
  })
  .strict();

export const updateVectorSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(4000).optional(),
    strideCategory: zStride.optional(),
    mcpCategory: zMcpCategory.optional(),
    likelihood: zRisk.optional(),
    impact: zRisk.optional(),
  })
  .strict();

// --- Finding ----------------------------------------------------------------

const dueDate = z
  .string()
  .datetime()
  .optional()
  .nullable()
  .or(z.literal(""));

// Review/revisit interval in days. null clears the reminder.
export const REVIEW_INTERVALS = [30, 60, 90] as const;
const reviewInterval = z
  .number()
  .int()
  .refine((v) => (REVIEW_INTERVALS as readonly number[]).includes(v), {
    message: "Interval must be 30, 60, or 90 days",
  })
  .nullable()
  .optional();

// Recurring owner-reminder interval in days (1–365). null turns reminders off.
const reminderInterval = z
  .number()
  .int()
  .min(1, "Reminder interval must be at least 1 day")
  .max(365, "Reminder interval cannot exceed 365 days")
  .nullable()
  .optional();

export const createFindingSchema = z
  .object({
    threatVectorId: z.string().min(1),
    title: z.string().trim().min(1, "Title is required").max(200),
    description: z.string().max(8000).optional().default(""),
    recommendation: z.string().max(8000).optional().default(""),
    severity: zSeverity.optional().default("MEDIUM"),
    status: zStatus.optional().default("OPEN"),
    owner: z.string().max(200).optional().default(""),
    dueDate,
    evidence: z.string().max(8000).optional().default(""),
    reviewIntervalDays: reviewInterval,
    reminderIntervalDays: reminderInterval,
  })
  .strict();

export const updateFindingSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(8000).optional(),
    recommendation: z.string().max(8000).optional(),
    severity: zSeverity.optional(),
    status: zStatus.optional(),
    owner: z.string().max(200).optional(),
    dueDate,
    evidence: z.string().max(8000).optional(),
    reviewIntervalDays: reviewInterval,
    reminderIntervalDays: reminderInterval,
  })
  .strict();

export const bulkFindingStatusSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(500),
    status: zStatus,
  })
  .strict();

// --- Members ----------------------------------------------------------------

export const inviteMemberSchema = z
  .object({
    email: z.string().trim().email().max(254),
    role: zRole.optional().default("MEMBER"),
    side: zPartySide.optional().default("CLIENT"),
  })
  .strict();

// --- Risk acceptance --------------------------------------------------------

export const requestAcceptanceSchema = z
  .object({
    justification: z.string().trim().min(1, "Justification is required").max(4000),
    residualRisk: z.string().max(4000).optional().default(""),
    reviewIntervalDays: reviewInterval,
  })
  .strict();

export const acceptanceDecisionSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT"]),
    comment: z.string().max(2000).optional().default(""),
  })
  .strict();

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    image: optionalUrl,
  })
  .strict();

export const changePasswordSchema = z
  .object({
    // Required only when the account already has a password; enforced in the route.
    currentPassword: z.string().max(200).optional(),
    newPassword: z.string().min(8, "Password must be at least 8 characters").max(200),
  })
  .strict();
