import { History } from "lucide-react";
import { describeAuditEvent } from "@/lib/audit-format";
import { Label } from "@/components/ui/label";
import type { AuditEvent } from "./types";

/** The finding's audit history, newest first as returned by the API. */
export function ActivitySection({
  auditLoading,
  auditEvents,
}: {
  auditLoading: boolean;
  auditEvents: AuditEvent[];
}) {
  return (
    <div className="space-y-2 border-t pt-4">
      <Label className="flex items-center gap-1.5">
        <History className="size-4" /> Activity
      </Label>
      {auditLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : auditEvents.length === 0 ? (
        <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
      ) : (
        <ul className="space-y-2 border-l pl-3">
          {auditEvents.map((e) => (
            <li key={e.id} className="text-sm">
              <div>
                <span className="font-medium">{e.actorLabel}</span>{" "}
                <span className="text-muted-foreground">{describeAuditEvent(e)}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(e.createdAt).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
