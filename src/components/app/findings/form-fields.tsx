import type { Dispatch, SetStateAction } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SEVERITIES, SEVERITY_LABELS, STATUS_LABELS, type FindingStatus } from "@/lib/taxonomy";
import { toDateInput, type FindingForm, type VectorOption } from "./types";

type SetForm = Dispatch<SetStateAction<FindingForm>>;

function RevisitField({
  form,
  setForm,
  editReviewDueAt,
}: {
  form: FindingForm;
  setForm: SetForm;
  editReviewDueAt: string | null;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="fnd-revisit-reminder">Revisit reminder</Label>
      <Select
        id="fnd-revisit-reminder"
        value={form.reviewInterval}
        onChange={(e) => setForm((f) => ({ ...f, reviewInterval: e.target.value }))}
      >
        <option value="">No revisit</option>
        <option value="30">Revisit in 30 days</option>
        <option value="60">Revisit in 60 days</option>
        <option value="90">Revisit in 90 days</option>
      </Select>
      <p className="text-xs text-muted-foreground">
        {form.reviewInterval
          ? `When this finding is Accepted, it automatically reopens ${form.reviewInterval} days later so the decision is revisited.`
          : "No automatic revisit — the finding keeps its status until you change it."}
        {editReviewDueAt ? ` Next review: ${toDateInput(editReviewDueAt)}.` : ""}
      </p>
    </div>
  );
}

function ReminderField({
  form,
  setForm,
  editingId,
  alerting,
  sendAlert,
  editReminder,
}: {
  form: FindingForm;
  setForm: SetForm;
  editingId: string | null;
  alerting: boolean;
  sendAlert: () => void;
  editReminder: { nextAt: string | null; lastAlertAt: string | null; owner: string };
}) {
  return (
    <div className="space-y-1.5">
      <Label>Owner reminder</Label>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Every</span>
        <Input
          type="number"
          min={1}
          max={365}
          className="w-20"
          placeholder="off"
          value={form.reminderInterval}
          onChange={(e) => setForm((f) => ({ ...f, reminderInterval: e.target.value }))}
        />
        <span className="text-sm text-muted-foreground">days</span>
        {editingId ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={sendAlert}
            disabled={alerting}
          >
            <Send className="size-4" /> {alerting ? "Sending…" : "Send alert now"}
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {form.reminderInterval
          ? `Emails the owner every ${form.reminderInterval} days while this finding is Open or In Progress.`
          : "No recurring reminder. Use “Send alert now” to email the owner once."}
        {editReminder.nextAt ? ` Next reminder: ${toDateInput(editReminder.nextAt)}.` : ""}
        {editReminder.lastAlertAt ? ` Last alert: ${toDateInput(editReminder.lastAlertAt)}.` : ""}
      </p>
      <p className="text-xs text-muted-foreground">
        The owner must be an email address to receive alerts.
      </p>
    </div>
  );
}

/** The editable fields of a finding, shown in the drawer for both creating and editing. */
export function FindingFormFields({
  form,
  setForm,
  vectors,
  editingId,
  statusOptionsFor,
  editReviewDueAt,
  editReminder,
  alerting,
  sendAlert,
}: {
  form: FindingForm;
  setForm: SetForm;
  vectors: VectorOption[];
  editingId: string | null;
  statusOptionsFor: (current: string) => FindingStatus[];
  editReviewDueAt: string | null;
  editReminder: { nextAt: string | null; lastAlertAt: string | null; owner: string };
  alerting: boolean;
  sendAlert: () => void;
}) {
  return (
    <>
      {!editingId ? (
        <div className="space-y-1.5">
          <Label htmlFor="fnd-threat-vector">Threat Vector</Label>
          <Select
            id="fnd-threat-vector"
            value={form.threatVectorId}
            onChange={(e) => setForm((f) => ({ ...f, threatVectorId: e.target.value }))}
          >
            {vectors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="fnd-title">Title</Label>
        <Input
          id="fnd-title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="fnd-severity">Severity</Label>
          <Select
            id="fnd-severity"
            value={form.severity}
            onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {SEVERITY_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fnd-status">Status</Label>
          {form.status === "PENDING_ACCEPTANCE" ? (
            <Select id="fnd-status" value="PENDING_ACCEPTANCE" disabled>
              <option value="PENDING_ACCEPTANCE">Pending Acceptance</option>
            </Select>
          ) : (
            <Select
              id="fnd-status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              {statusOptionsFor(form.status).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="fnd-owner">Owner</Label>
          <Input
            id="fnd-owner"
            value={form.owner}
            onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
            placeholder="name or email"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fnd-due-date">Due date</Label>
          <Input
            id="fnd-due-date"
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
          />
        </div>
      </div>
      <RevisitField form={form} setForm={setForm} editReviewDueAt={editReviewDueAt} />
      <ReminderField
        form={form}
        setForm={setForm}
        editingId={editingId}
        alerting={alerting}
        sendAlert={sendAlert}
        editReminder={editReminder}
      />
      <div className="space-y-1.5">
        <Label htmlFor="fnd-description">Description</Label>
        <Textarea
          id="fnd-description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fnd-recommendation">Recommendation</Label>
        <Textarea
          id="fnd-recommendation"
          value={form.recommendation}
          onChange={(e) => setForm((f) => ({ ...f, recommendation: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fnd-evidence">Evidence</Label>
        <Textarea
          id="fnd-evidence"
          value={form.evidence}
          onChange={(e) => setForm((f) => ({ ...f, evidence: e.target.value }))}
        />
      </div>
    </>
  );
}
