import { prisma } from "@/lib/prisma";

// Append-only audit logging for findings. Every change that matters (create,
// field/status updates, evidence edits, attachments, alerts, deletion, auto-reopen)
// records who did it and when.

export type AuditAction =
  | "CREATED"
  | "UPDATED"
  | "STATUS_CHANGED"
  | "DELETED"
  | "REOPENED"
  | "ATTACHMENT_ADDED"
  | "ATTACHMENT_REMOVED"
  | "ALERT_SENT"
  | "REMINDER_SENT"
  | "ACCEPTANCE_REQUESTED"
  | "ACCEPTANCE_APPROVED"
  | "ACCEPTANCE_REJECTED"
  | "ACCEPTANCE_CANCELLED"
  | "ACCEPTANCE_EXPIRED"
  | "RISK_ACCEPTED";

export interface AuditInput {
  projectId: string;
  findingId?: string | null;
  actorId?: string | null;
  actorLabel?: string;
  action: AuditAction;
  field?: string;
  oldValue?: string | null;
  newValue?: string | null;
  detail?: string | null;
}

function clip(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v);
  return s.length > 500 ? `${s.slice(0, 497)}…` : s;
}

export async function recordAudit(event: AuditInput): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      projectId: event.projectId,
      findingId: event.findingId ?? null,
      actorId: event.actorId ?? null,
      actorLabel: event.actorLabel ?? "unknown",
      action: event.action,
      field: event.field ?? null,
      oldValue: clip(event.oldValue),
      newValue: clip(event.newValue),
      detail: clip(event.detail),
    },
  });
}

// Fields whose changes are tracked when a finding is updated, with friendly labels.
export const TRACKED_FINDING_FIELDS: { key: string; label: string; longText?: boolean }[] = [
  { key: "title", label: "Title" },
  { key: "severity", label: "Severity" },
  { key: "status", label: "Status" },
  { key: "owner", label: "Owner" },
  { key: "dueDate", label: "Due date" },
  { key: "description", label: "Description", longText: true },
  { key: "recommendation", label: "Recommendation", longText: true },
  { key: "evidence", label: "Evidence", longText: true },
  { key: "reviewIntervalDays", label: "Revisit reminder" },
  { key: "reminderIntervalDays", label: "Owner reminder" },
];
