"use client";

import {
  BellRing,
  CalendarClock,
  Download,
  History,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Send,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AcceptancePanel, type AcceptanceInfo } from "@/components/app/acceptance-panel";
import { ATTACHMENT_ACCEPT, humanSize } from "@/lib/attachments";
import { describeAuditEvent } from "@/lib/audit-format";
import { findingColor } from "@/lib/finding-colors";
import type { PartySide } from "@/lib/taxonomy";
import { AiBadge, ConfidenceBadge, McpCategoryBadge, SeverityBadge, StatusPill } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  FINDING_STATUSES,
  MANUAL_STATUSES,
  SEVERITIES,
  SEVERITY_LABELS,
  SEVERITY_RANK,
  STATUS_LABELS,
  type FindingStatus,
  type Severity,
} from "@/lib/taxonomy";

export interface FindingRow {
  id: string;
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
interface AuditEvent {
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

type SortKey = "severity" | "status" | "owner" | "dueDate";

const emptyForm = {
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

function toDateInput(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "";
}


export function FindingsTable({
  projectId,
  findings,
  vectors,
  editable = false,
  acceptancePolicy = "OFF",
  viewerSide = "ASSESSOR",
  viewerId = null,
  initialOpenId = null,
}: {
  projectId: string;
  findings: FindingRow[];
  vectors: VectorOption[];
  editable?: boolean;
  acceptancePolicy?: string;
  viewerSide?: PartySide;
  viewerId?: string | null;
  initialOpenId?: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("severity");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("MITIGATED");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [editReviewDueAt, setEditReviewDueAt] = useState<string | null>(null);
  const [editReminder, setEditReminder] = useState<{
    nextAt: string | null;
    lastAlertAt: string | null;
    owner: string;
  }>({ nextAt: null, lastAlertAt: null, owner: "" });
  const [alerting, setAlerting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const currentFinding = editingId ? findings.find((f) => f.id === editingId) : undefined;

  // ACCEPTED is only directly selectable when there is no approval policy; the
  // acceptance workflow handles it otherwise. PENDING_ACCEPTANCE is never manual.
  const statusOptionsFor = (current: string): FindingStatus[] => {
    let opts = MANUAL_STATUSES.slice();
    if (acceptancePolicy !== "OFF" && current !== "ACCEPTED") {
      opts = opts.filter((s) => s !== "ACCEPTED");
    }
    return opts;
  };

  // Open a specific finding's drawer once when arriving via ?finding=<id>.
  const openedInitial = useRef(false);
  useEffect(() => {
    if (openedInitial.current || !initialOpenId) return;
    const f = findings.find((x) => x.id === initialOpenId);
    if (f) {
      openedInitial.current = true;
      openEdit(f);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOpenId, findings]);

  const filtered = useMemo(() => {
    const rows = findings.filter(
      (f) =>
        (!severityFilter || f.severity === severityFilter) &&
        (!statusFilter || f.status === statusFilter) &&
        (!ownerFilter || f.owner.toLowerCase().includes(ownerFilter.toLowerCase())),
    );
    return [...rows].sort((a, b) => {
      switch (sortKey) {
        case "severity":
          return (SEVERITY_RANK[b.severity as Severity] ?? 0) - (SEVERITY_RANK[a.severity as Severity] ?? 0);
        case "status":
          return a.status.localeCompare(b.status);
        case "owner":
          return a.owner.localeCompare(b.owner);
        case "dueDate":
          return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
      }
    });
  }, [findings, severityFilter, statusFilter, ownerFilter, sortKey]);

  async function loadAudit(id: string) {
    setAuditLoading(true);
    const res = await fetch(`/api/projects/${projectId}/findings/${id}/audit`);
    const data = await res.json().catch(() => ({}));
    setAuditLoading(false);
    if (res.ok) setAuditEvents(data.events ?? []);
  }

  async function uploadFile(file: File) {
    if (!editingId) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/projects/${projectId}/findings/${editingId}/attachments`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) {
      toast(data.error ?? "Upload failed.", "error");
      return;
    }
    toast("Attachment uploaded.", "success");
    router.refresh();
    loadAudit(editingId);
  }

  async function deleteAttachment(aid: string) {
    if (!editingId) return;
    const res = await fetch(
      `/api/projects/${projectId}/findings/${editingId}/attachments/${aid}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      toast("Failed to remove attachment.", "error");
      return;
    }
    toast("Attachment removed.", "success");
    router.refresh();
    loadAudit(editingId);
  }

  function openCreate() {
    setEditingId(null);
    setEditReviewDueAt(null);
    setEditReminder({ nextAt: null, lastAlertAt: null, owner: "" });
    setAuditEvents([]);
    setForm({ ...emptyForm, threatVectorId: vectors[0]?.id ?? "" });
    setDrawerOpen(true);
  }
  function openEdit(f: FindingRow) {
    setEditingId(f.id);
    setEditReviewDueAt(f.reviewDueAt);
    setEditReminder({ nextAt: f.reminderNextAt, lastAlertAt: f.lastAlertAt, owner: f.owner });
    setForm({
      threatVectorId: f.threatVector?.id ?? "",
      title: f.title,
      severity: f.severity,
      status: f.status,
      owner: f.owner,
      dueDate: toDateInput(f.dueDate),
      description: f.description,
      recommendation: f.recommendation,
      evidence: f.evidence,
      reviewInterval: f.reviewIntervalDays ? String(f.reviewIntervalDays) : "",
      reminderInterval: f.reminderIntervalDays ? String(f.reminderIntervalDays) : "",
    });
    setAuditEvents([]);
    loadAudit(f.id);
    setDrawerOpen(true);
  }

  async function sendAlert() {
    if (!editingId) return;
    setAlerting(true);
    const res = await fetch(`/api/projects/${projectId}/findings/${editingId}/alert`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    setAlerting(false);
    if (!res.ok) {
      toast(data.error ?? "Failed to send alert.", "error");
      return;
    }
    toast(
      data.transport === "smtp"
        ? `Alert emailed to ${data.to}.`
        : `Alert logged for ${data.to} (no SMTP configured).`,
      "success",
    );
    router.refresh();
    if (editingId) loadAudit(editingId);
  }

  async function submitForm() {
    setSaving(true);
    const payload: Record<string, unknown> = {
      title: form.title,
      severity: form.severity,
      status: form.status,
      owner: form.owner,
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : "",
      description: form.description,
      recommendation: form.recommendation,
      evidence: form.evidence,
      reviewIntervalDays: form.reviewInterval ? Number(form.reviewInterval) : null,
      reminderIntervalDays: form.reminderInterval ? Number(form.reminderInterval) : null,
    };
    let res: Response;
    if (editingId) {
      res = await fetch(`/api/projects/${projectId}/findings/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      payload.threatVectorId = form.threatVectorId;
      res = await fetch(`/api/projects/${projectId}/findings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast(data.error ?? "Failed to save finding.", "error");
      return;
    }
    toast(editingId ? "Finding updated." : "Finding created.", "success");
    setDrawerOpen(false);
    router.refresh();
  }

  async function inlineStatus(id: string, status: string) {
    const res = await fetch(`/api/projects/${projectId}/findings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      toast("Failed to update status.", "error");
      return;
    }
    router.refresh();
  }

  async function applyBulk() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const res = await fetch(`/api/projects/${projectId}/findings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, status: bulkStatus }),
    });
    if (!res.ok) {
      toast("Bulk update failed.", "error");
      return;
    }
    toast(`Updated ${ids.length} findings.`, "success");
    setSelected(new Set());
    router.refresh();
  }

  async function remove() {
    if (!editingId) return;
    if (!confirm("Delete this finding?")) return;
    const res = await fetch(`/api/projects/${projectId}/findings/${editingId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast("Failed to delete.", "error");
      return;
    }
    toast("Finding deleted.", "success");
    setDrawerOpen(false);
    router.refresh();
  }

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = filtered.length > 0 && filtered.every((f) => selected.has(f.id));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Severity</Label>
          <Select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="h-8 w-36"
          >
            <option value="">All severities</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {SEVERITY_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 w-36"
          >
            <option value="">All statuses</option>
            {FINDING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        {editable ? (
          <div className="space-y-1">
            <Label className="text-xs">Owner</Label>
            <Input
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              placeholder="Filter owner…"
              className="h-8 w-40"
            />
          </div>
        ) : null}
        <div className="space-y-1">
          <Label className="text-xs">Sort by</Label>
          <Select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="h-8 w-36"
          >
            <option value="severity">Severity</option>
            <option value="status">Status</option>
            <option value="owner">Owner</option>
            <option value="dueDate">Due date</option>
          </Select>
        </div>
        {editable ? (
          <div className="ml-auto">
            <Button size="sm" onClick={openCreate} disabled={vectors.length === 0}>
              <Plus className="size-4" /> New Finding
            </Button>
          </div>
        ) : null}
      </div>

      {editable && selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-2 text-sm">
          <span className="text-muted-foreground">{selected.size} selected</span>
          <Select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
            className="h-8 w-40"
          >
            {statusOptionsFor("").map((s) => (
              <option key={s} value={s}>
                Set to {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          <Button size="sm" onClick={applyBulk}>
            Apply
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title={findings.length === 0 ? "No findings yet" : "No matching findings"}
          description={
            findings.length === 0
              ? editable
                ? "Create a finding to start tracking mitigations."
                : "Findings created in the workspace will appear here."
              : "Try clearing the filters."
          }
          action={
            editable && findings.length === 0 && vectors.length > 0 ? (
              <Button size="sm" onClick={openCreate}>
                <Plus className="size-4" /> New Finding
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1 p-0" />
              {editable ? (
                <TableHead className="w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked ? new Set(filtered.map((f) => f.id)) : new Set(),
                      )
                    }
                    aria-label="Select all"
                  />
                </TableHead>
              ) : null}
              <TableHead>Severity</TableHead>
              <TableHead>Finding</TableHead>
              <TableHead className="hidden md:table-cell">Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Owner</TableHead>
              <TableHead className="hidden lg:table-cell">Due</TableHead>
              {editable ? <TableHead className="w-10" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((f) => (
              <TableRow key={f.id}>
                <TableCell
                  className="w-1 p-0"
                  style={{ backgroundColor: findingColor(f.severity, f.status) }}
                />
                {editable ? (
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selected.has(f.id)}
                      onChange={() => toggle(f.id)}
                      aria-label={`Select ${f.title}`}
                    />
                  </TableCell>
                ) : null}
                <TableCell>
                  <SeverityBadge severity={f.severity} />
                </TableCell>
                <TableCell className="max-w-xs">
                  <div className="font-medium">{f.title}</div>
                  {f.threatVector ? (
                    <div className="text-xs text-muted-foreground">{f.threatVector.title}</div>
                  ) : null}
                  {f.source === "AI" ? (
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <AiBadge />
                      {f.confidence ? <ConfidenceBadge confidence={f.confidence} /> : null}
                    </div>
                  ) : null}
                  {f.reviewDueAt ? (
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <CalendarClock className="size-3" /> Revisit {toDateInput(f.reviewDueAt)}
                    </div>
                  ) : null}
                  {f.reminderIntervalDays ? (
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400">
                      <BellRing className="size-3" /> Reminds owner every {f.reminderIntervalDays}d
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {f.threatVector ? (
                    <McpCategoryBadge category={f.threatVector.mcpCategory} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {editable && f.status !== "PENDING_ACCEPTANCE" ? (
                    <Select
                      value={f.status}
                      onChange={(e) => inlineStatus(f.id, e.target.value)}
                      className="h-8 w-36"
                    >
                      {statusOptionsFor(f.status).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <StatusPill status={f.status} />
                  )}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                  {f.owner || "—"}
                </TableCell>
                <TableCell className="hidden whitespace-nowrap text-sm tabular-nums text-muted-foreground lg:table-cell">
                  {f.dueDate ? toDateInput(f.dueDate) : "—"}
                </TableCell>
                {editable ? (
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(f)} aria-label="Edit">
                      <Pencil className="size-4" />
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={editingId ? "Edit Finding" : "New Finding"}
        description={editingId ? undefined : "Attach this finding to a threat vector."}
      >
        <div className="space-y-4">
          {!editingId ? (
            <div className="space-y-1.5">
              <Label>Threat Vector</Label>
              <Select
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
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Severity</Label>
              <Select
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
              <Label>Status</Label>
              {form.status === "PENDING_ACCEPTANCE" ? (
                <Select value="PENDING_ACCEPTANCE" disabled>
                  <option value="PENDING_ACCEPTANCE">Pending Acceptance</option>
                </Select>
              ) : (
                <Select
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
              <Label>Owner</Label>
              <Input
                value={form.owner}
                onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
                placeholder="name or email"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Revisit reminder</Label>
            <Select
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
              {editReminder.lastAlertAt
                ? ` Last alert: ${toDateInput(editReminder.lastAlertAt)}.`
                : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              The owner must be an email address to receive alerts.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Recommendation</Label>
            <Textarea
              value={form.recommendation}
              onChange={(e) => setForm((f) => ({ ...f, recommendation: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Evidence</Label>
            <Textarea
              value={form.evidence}
              onChange={(e) => setForm((f) => ({ ...f, evidence: e.target.value }))}
            />
          </div>
          {editingId ? (
            <>
              {currentFinding ? (
                <div className="border-t pt-4">
                  <AcceptancePanel
                    projectId={projectId}
                    findingId={editingId}
                    status={currentFinding.status}
                    severity={currentFinding.severity}
                    acceptancePolicy={acceptancePolicy}
                    viewerSide={viewerSide}
                    viewerId={viewerId}
                    acceptance={currentFinding.acceptance}
                    onChanged={() => {
                      router.refresh();
                      loadAudit(editingId);
                    }}
                  />
                </div>
              ) : null}
              <div className="space-y-2 border-t pt-4">
                <Label className="flex items-center gap-1.5">
                  <Paperclip className="size-4" /> Attachments
                </Label>
                {(currentFinding?.attachments ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No attachments yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {currentFinding!.attachments.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="truncate">{a.filename}</div>
                          <div className="text-xs text-muted-foreground">
                            {humanSize(a.size)} · {a.uploadedByLabel || "—"}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <a
                            href={`/api/projects/${projectId}/findings/${editingId}/attachments/${a.id}`}
                            className={buttonVariants({ variant: "ghost", size: "icon" })}
                            aria-label={`Download ${a.filename}`}
                          >
                            <Download className="size-4" />
                          </a>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteAttachment(a.id)}
                            aria-label={`Remove ${a.filename}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <label
                  className={`${buttonVariants({ variant: "outline", size: "sm" })} cursor-pointer`}
                >
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  {uploading ? "Uploading…" : "Upload file"}
                  <input
                    type="file"
                    className="hidden"
                    accept={ATTACHMENT_ACCEPT}
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadFile(file);
                      e.target.value = "";
                    }}
                  />
                </label>
                <p className="text-xs text-muted-foreground">DOCX, PDF, or image files. Max 15 MB.</p>
              </div>

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
            </>
          ) : (
            <p className="border-t pt-4 text-xs text-muted-foreground">
              Save the finding to add attachments and view its activity log.
            </p>
          )}

          <div className="flex justify-between gap-2 border-t pt-4">
            {editingId ? (
              <Button variant="destructive" onClick={remove}>
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDrawerOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submitForm} disabled={saving || !form.title}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
