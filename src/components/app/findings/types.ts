import type { AcceptanceInfo } from "@/components/app/acceptance-panel";

export interface FindingRow {
  id: string;
  /** Stable-for-the-export reference such as F-001, assigned by creation order. */
  displayId: string;
  title: string;
  description: string;
  recommendation: string;
  severity: string;
  status: string;
  source?: string;
  confidence?: string | null;
  owner: string;
  dueDate: string | null;
  evidence: string;
  reviewIntervalDays: number | null;
  reviewDueAt: string | null;
  reminderIntervalDays: number | null;
  reminderNextAt: string | null;
  lastAlertAt: string | null;
  attachments: AttachmentMeta[];
  acceptance: AcceptanceInfo | null;
  threatVector?: { id: string; title: string; mcpCategory: string } | null;
}
export interface AttachmentMeta {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedByLabel: string;
  createdAt: string;
}
export interface AuditEvent {
  id: string;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  detail: string | null;
  actorLabel: string;
  createdAt: string;
}
export interface VectorOption {
  id: string;
  title: string;
}

export type SortKey = "severity" | "status" | "owner" | "dueDate";

export const emptyForm = {
  threatVectorId: "",
  title: "",
  severity: "MEDIUM",
  status: "OPEN",
  owner: "",
  dueDate: "",
  description: "",
  recommendation: "",
  evidence: "",
  reviewInterval: "", // "" = no revisit, else "30" | "60" | "90"
  reminderInterval: "", // "" = off, else number of days as string
};

export type FindingForm = typeof emptyForm;

export function toDateInput(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "";
}
