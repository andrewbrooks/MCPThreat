"use client";

import { Check, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ProjectStatusBadge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  ACCEPTANCE_POLICIES,
  ACCEPTANCE_POLICY_DESCRIPTIONS,
  ACCEPTANCE_POLICY_LABELS,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  type AcceptancePolicy,
} from "@/lib/taxonomy";

interface Props {
  projectId: string;
  initial: {
    name: string;
    description: string;
    mcpServerUrl: string;
    architecture: string;
    status: string;
    acceptancePolicy: string;
  };
}

export function ProjectDetailsEditor({ projectId, initial }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(initial);

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast(data.error ?? "Failed to save.", "error");
      return;
    }
    toast("Project updated.", "success");
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{initial.name}</h1>
              <ProjectStatusBadge status={initial.status} />
            </div>
            {initial.description ? (
              <p className="text-sm text-muted-foreground">{initial.description}</p>
            ) : null}
            {initial.mcpServerUrl ? (
              <p className="break-all text-sm">
                <span className="text-muted-foreground">MCP server: </span>
                <span className="font-mono">{initial.mcpServerUrl}</span>
              </p>
            ) : null}
            <p className="text-sm">
              <span className="text-muted-foreground">Risk acceptance: </span>
              {ACCEPTANCE_POLICY_LABELS[initial.acceptancePolicy as AcceptancePolicy] ??
                initial.acceptancePolicy}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> Edit
          </Button>
        </div>
        <div>
          <h2 className="mb-1 text-sm font-medium text-muted-foreground">Architecture Notes</h2>
          <p className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm">
            {initial.architecture || "No architecture notes yet."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={form.name} onChange={set("name")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <Select id="status" value={form.status} onChange={set("status")}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" value={form.description} onChange={set("description")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mcpServerUrl">MCP Server URL</Label>
        <Input id="mcpServerUrl" value={form.mcpServerUrl} onChange={set("mcpServerUrl")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="architecture">Architecture Notes</Label>
        <Textarea
          id="architecture"
          className="min-h-[120px]"
          value={form.architecture}
          onChange={set("architecture")}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="acceptancePolicy">Risk-acceptance policy</Label>
        <Select id="acceptancePolicy" value={form.acceptancePolicy} onChange={set("acceptancePolicy")}>
          {ACCEPTANCE_POLICIES.map((p) => (
            <option key={p} value={p}>
              {ACCEPTANCE_POLICY_LABELS[p]}
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted-foreground">
          {ACCEPTANCE_POLICY_DESCRIPTIONS[form.acceptancePolicy as AcceptancePolicy]}
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setForm(initial);
            setEditing(false);
          }}
        >
          <X className="size-4" /> Cancel
        </Button>
        <Button onClick={save} disabled={saving}>
          <Check className="size-4" /> {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
