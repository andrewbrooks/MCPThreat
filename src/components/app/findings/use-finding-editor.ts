import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/toast";
import {
  emptyForm,
  toDateInput,
  type AuditEvent,
  type FindingRow,
  type VectorOption,
} from "./types";

/** State and actions for the finding drawer: opening it for a new or existing finding, the
 *  form, saving, deleting, attachments, owner alerts and the finding's audit log. */
export function useFindingEditor({
  projectId,
  findings,
  vectors,
  initialOpenId,
}: {
  projectId: string;
  findings: FindingRow[];
  vectors: VectorOption[];
  initialOpenId: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();

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
    const res = await fetch(`/api/projects/${projectId}/findings/${editingId}/attachments/${aid}`, {
      method: "DELETE",
    });
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

  return {
    drawerOpen,
    setDrawerOpen,
    editingId,
    form,
    setForm,
    editReviewDueAt,
    editReminder,
    alerting,
    saving,
    uploading,
    auditEvents,
    auditLoading,
    currentFinding,
    openCreate,
    openEdit,
    sendAlert,
    submitForm,
    remove,
    uploadFile,
    deleteAttachment,
    loadAudit,
  };
}
