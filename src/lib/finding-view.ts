// Maps a Prisma finding (with the relations loaded by getProjectDetail) into the
// serializable row shape the client FindingsTable expects. Dates become ISO strings.

interface RawAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedByLabel: string;
  createdAt: Date;
}

interface RawAcceptance {
  id: string;
  status: string;
  requireBothSides: boolean;
  justification: string;
  residualRisk: string;
  requestedById: string | null;
  requestedByLabel: string;
  assessorApproverLabel: string | null;
  assessorApprovedAt: Date | null;
  clientApproverLabel: string | null;
  clientApprovedAt: Date | null;
  reviewIntervalDays: number | null;
  expiresAt: Date | null;
  rejectedByLabel: string | null;
  rejectedReason: string | null;
}

interface RawFinding {
  id: string;
  title: string;
  description: string;
  recommendation: string;
  severity: string;
  status: string;
  owner: string;
  dueDate: Date | null;
  evidence: string;
  reviewIntervalDays: number | null;
  reviewDueAt: Date | null;
  reminderIntervalDays: number | null;
  reminderNextAt: Date | null;
  lastAlertAt: Date | null;
  attachments: RawAttachment[];
  acceptanceRequests: RawAcceptance[];
  threatVector: { id: string; title: string; mcpCategory: string } | null;
}

export function mapFindingRow(f: RawFinding) {
  const ar = f.acceptanceRequests[0];
  return {
    id: f.id,
    title: f.title,
    description: f.description,
    recommendation: f.recommendation,
    severity: f.severity,
    status: f.status,
    owner: f.owner,
    dueDate: f.dueDate ? f.dueDate.toISOString() : null,
    evidence: f.evidence,
    reviewIntervalDays: f.reviewIntervalDays,
    reviewDueAt: f.reviewDueAt ? f.reviewDueAt.toISOString() : null,
    reminderIntervalDays: f.reminderIntervalDays,
    reminderNextAt: f.reminderNextAt ? f.reminderNextAt.toISOString() : null,
    lastAlertAt: f.lastAlertAt ? f.lastAlertAt.toISOString() : null,
    attachments: f.attachments.map((a) => ({
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size,
      uploadedByLabel: a.uploadedByLabel,
      createdAt: a.createdAt.toISOString(),
    })),
    acceptance: ar
      ? {
          id: ar.id,
          status: ar.status,
          requireBothSides: ar.requireBothSides,
          justification: ar.justification,
          residualRisk: ar.residualRisk,
          requestedById: ar.requestedById,
          requestedByLabel: ar.requestedByLabel,
          assessorApproverLabel: ar.assessorApproverLabel,
          assessorApprovedAt: ar.assessorApprovedAt ? ar.assessorApprovedAt.toISOString() : null,
          clientApproverLabel: ar.clientApproverLabel,
          clientApprovedAt: ar.clientApprovedAt ? ar.clientApprovedAt.toISOString() : null,
          reviewIntervalDays: ar.reviewIntervalDays,
          expiresAt: ar.expiresAt ? ar.expiresAt.toISOString() : null,
          rejectedByLabel: ar.rejectedByLabel,
          rejectedReason: ar.rejectedReason,
        }
      : null,
    threatVector: f.threatVector
      ? { id: f.threatVector.id, title: f.threatVector.title, mcpCategory: f.threatVector.mcpCategory }
      : null,
  };
}
