"use client";

import { Pencil, Plus, ShieldAlert, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { TRUST_BOUNDARY_LABELS, TRUST_BOUNDARY_TYPES } from "@/lib/taxonomy";

export interface BoundaryItem {
  id: string;
  label: string;
  type: string;
  description: string;
  vectorCount: number;
}

const blank = { label: "", type: TRUST_BOUNDARY_TYPES[0] as string, description: "" };

export function BoundaryManager({
  projectId,
  boundaries,
}: {
  projectId: string;
  boundaries: BoundaryItem[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState({ ...blank });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setForm({ ...blank });
    setEditingId(null);
  }

  async function save() {
    if (!form.label.trim()) {
      toast("Label is required.", "error");
      return;
    }
    setBusy(true);
    const url = editingId
      ? `/api/projects/${projectId}/boundaries/${editingId}`
      : `/api/projects/${projectId}/boundaries`;
    const res = await fetch(url, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast(data.error ?? "Failed to save boundary.", "error");
      return;
    }
    toast(editingId ? "Boundary updated." : "Boundary added.", "success");
    reset();
    router.refresh();
  }

  async function del(id: string) {
    if (!confirm("Delete this boundary and its threat vectors?")) return;
    const res = await fetch(`/api/projects/${projectId}/boundaries/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast("Failed to delete.", "error");
      return;
    }
    toast("Boundary deleted.", "success");
    if (editingId === id) reset();
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <h3 className="font-medium">{editingId ? "Edit boundary" : "Add a trust boundary"}</h3>
        <div className="space-y-1.5">
          <Label>Label</Label>
          <Input
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            placeholder="Agent → MCP Server"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
          >
            {TRUST_BOUNDARY_TYPES.map((t) => (
              <option key={t} value={t}>
                {TRUST_BOUNDARY_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="What crosses this boundary?"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={save} disabled={busy}>
            {editingId ? <Pencil className="size-4" /> : <Plus className="size-4" />}
            {editingId ? "Save" : "Add boundary"}
          </Button>
          {editingId ? (
            <Button variant="outline" onClick={reset}>
              <X className="size-4" /> Cancel
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-medium">
          Trust boundaries{" "}
          <span className="text-muted-foreground">({boundaries.length})</span>
        </h3>
        {boundaries.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title="No boundaries yet"
            description="Add the trust boundaries of your MCP deployment on the left."
          />
        ) : (
          <div className="space-y-2">
            {boundaries.map((b) => (
              <div key={b.id} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{b.label}</span>
                      <Badge className="border-border bg-muted text-muted-foreground">
                        {TRUST_BOUNDARY_LABELS[b.type as keyof typeof TRUST_BOUNDARY_LABELS] ??
                          b.type}
                      </Badge>
                    </div>
                    {b.description ? (
                      <p className="mt-0.5 text-sm text-muted-foreground">{b.description}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {b.vectorCount} threat vector{b.vectorCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingId(b.id);
                        setForm({ label: b.label, type: b.type, description: b.description });
                      }}
                      aria-label="Edit boundary"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => del(b.id)}
                      aria-label="Delete boundary"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
