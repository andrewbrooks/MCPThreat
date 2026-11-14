"use client";

import { Plus, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AcceptancePanel } from "@/components/app/acceptance-panel";
import { ActivitySection } from "@/components/app/findings/activity-section";
import { AttachmentsSection } from "@/components/app/findings/attachments-section";
import { FindingsGrid } from "@/components/app/findings/findings-grid";
import { FindingFormFields } from "@/components/app/findings/form-fields";
import { BulkBar, FindingsFilters } from "@/components/app/findings/filters";
import { useFindingEditor } from "@/components/app/findings/use-finding-editor";
import type { FindingRow, SortKey, VectorOption } from "@/components/app/findings/types";
import type { PartySide } from "@/lib/taxonomy";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { useToast } from "@/components/ui/toast";
import { MANUAL_STATUSES, SEVERITY_RANK, type FindingStatus, type Severity } from "@/lib/taxonomy";

export type { AttachmentMeta, FindingRow, VectorOption } from "@/components/app/findings/types";

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

  const {
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
  } = useFindingEditor({ projectId, findings, vectors, initialOpenId });

  // ACCEPTED is only directly selectable when there is no approval policy; the
  // acceptance workflow handles it otherwise. PENDING_ACCEPTANCE is never manual.
  const statusOptionsFor = (current: string): FindingStatus[] => {
    let opts = MANUAL_STATUSES.slice();
    if (acceptancePolicy !== "OFF" && current !== "ACCEPTED") {
      opts = opts.filter((s) => s !== "ACCEPTED");
    }
    return opts;
  };

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
          return (
            (SEVERITY_RANK[b.severity as Severity] ?? 0) -
            (SEVERITY_RANK[a.severity as Severity] ?? 0)
          );
        case "status":
          return a.status.localeCompare(b.status);
        case "owner":
          return a.owner.localeCompare(b.owner);
        case "dueDate":
          return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
      }
    });
  }, [findings, severityFilter, statusFilter, ownerFilter, sortKey]);

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
      <FindingsFilters
        severityFilter={severityFilter}
        setSeverityFilter={setSeverityFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        ownerFilter={ownerFilter}
        setOwnerFilter={setOwnerFilter}
        sortKey={sortKey}
        setSortKey={setSortKey}
        editable={editable}
        openCreate={openCreate}
        noVectors={vectors.length === 0}
      />

      {editable && selected.size > 0 ? (
        <BulkBar
          selectedCount={selected.size}
          bulkStatus={bulkStatus}
          setBulkStatus={setBulkStatus}
          statusOptions={statusOptionsFor("")}
          applyBulk={applyBulk}
          clearSelection={() => setSelected(new Set())}
        />
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
        <FindingsGrid
          filtered={filtered}
          editable={editable}
          selected={selected}
          allSelected={allSelected}
          setSelected={setSelected}
          toggle={toggle}
          inlineStatus={inlineStatus}
          statusOptionsFor={statusOptionsFor}
          openEdit={openEdit}
        />
      )}

      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={
          editingId
            ? `Edit finding ${findings.find((x) => x.id === editingId)?.displayId ?? ""}`.trim()
            : "New finding"
        }
        description={editingId ? undefined : "Attach this finding to a threat vector."}
      >
        <div className="space-y-4">
          <FindingFormFields
            form={form}
            setForm={setForm}
            vectors={vectors}
            editingId={editingId}
            statusOptionsFor={statusOptionsFor}
            editReviewDueAt={editReviewDueAt}
            editReminder={editReminder}
            alerting={alerting}
            sendAlert={sendAlert}
          />
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
              <AttachmentsSection
                projectId={projectId}
                editingId={editingId}
                attachments={currentFinding?.attachments ?? []}
                uploading={uploading}
                uploadFile={uploadFile}
                deleteAttachment={deleteAttachment}
              />

              <ActivitySection auditLoading={auditLoading} auditEvents={auditEvents} />
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
