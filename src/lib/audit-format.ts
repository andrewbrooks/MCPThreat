// Prisma-free formatting for audit events, shared by the client drawer and the
// server-rendered activity page.

export interface AuditEventView {
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  detail: string | null;
}

export function describeAuditEvent(e: AuditEventView): string {
  switch (e.action) {
    case "CREATED":
      return "created this finding";
    case "DELETED":
      return "deleted this finding";
    case "REOPENED":
      return e.detail ?? "auto-reopened after the review timer elapsed";
    case "ATTACHMENT_ADDED":
      return `added attachment “${e.detail ?? "file"}”`;
    case "ATTACHMENT_REMOVED":
      return `removed attachment “${e.detail ?? "file"}”`;
    case "ALERT_SENT":
      return e.detail ?? "sent an alert to the owner";
    case "REMINDER_SENT":
      return e.detail ?? "reminder sent to the owner";
    case "ACCEPTANCE_REQUESTED":
      return e.detail ?? "requested risk acceptance";
    case "ACCEPTANCE_APPROVED":
      return e.detail ?? "approved the acceptance request";
    case "ACCEPTANCE_REJECTED":
      return e.detail ?? "rejected the acceptance request";
    case "ACCEPTANCE_CANCELLED":
      return e.detail ?? "cancelled the acceptance request";
    case "ACCEPTANCE_EXPIRED":
      return e.detail ?? "risk acceptance expired";
    case "RISK_ACCEPTED":
      return e.detail ?? "risk accepted";
    case "STATUS_CHANGED":
      return `changed Status from ${e.oldValue ?? "—"} to ${e.newValue ?? "—"}`;
    case "UPDATED": {
      const field = e.field ?? "a field";
      const short = (e.newValue?.length ?? 0) <= 40 && (e.oldValue?.length ?? 0) <= 40;
      return short
        ? `changed ${field} from ${e.oldValue ?? "—"} to ${e.newValue ?? "—"}`
        : `updated ${field}`;
    }
    default:
      return e.action;
  }
}
