"use client";

import { Boxes, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { KnowledgePanel } from "@/components/app/knowledge-panel";
import { McpCategoryBadge, RiskBadge, StrideBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  MCP_CATEGORIES,
  MCP_CATEGORY_LABELS,
  RISK_LEVELS,
  RISK_LEVEL_LABELS,
  STRIDE_CATEGORIES,
  STRIDE_LABELS,
  type McpCategory,
} from "@/lib/taxonomy";

export interface VectorItem {
  id: string;
  trustBoundaryId: string;
  title: string;
  description: string;
  strideCategory: string;
  mcpCategory: string;
  likelihood: string;
  impact: string;
}
interface BoundaryOption {
  id: string;
  label: string;
}

export function VectorManager({
  projectId,
  boundaries,
  vectors,
}: {
  projectId: string;
  boundaries: BoundaryOption[];
  vectors: VectorItem[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    trustBoundaryId: boundaries[0]?.id ?? "",
    title: "",
    description: "",
    strideCategory: STRIDE_CATEGORIES[0] as string,
    mcpCategory: MCP_CATEGORIES[0] as string,
    likelihood: "MEDIUM",
    impact: "MEDIUM",
  });

  async function add() {
    if (!form.trustBoundaryId) {
      toast("Add a trust boundary first.", "error");
      return;
    }
    if (!form.title.trim()) {
      toast("Title is required.", "error");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/projects/${projectId}/vectors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast(data.error ?? "Failed to add vector.", "error");
      return;
    }
    toast("Threat vector mapped.", "success");
    setForm((f) => ({ ...f, title: "", description: "" }));
    router.refresh();
  }

  async function del(id: string) {
    if (!confirm("Delete this threat vector and its findings?")) return;
    const res = await fetch(`/api/projects/${projectId}/vectors/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Failed to delete.", "error");
      return;
    }
    toast("Vector deleted.", "success");
    router.refresh();
  }

  const boundaryLabel = (id: string) => boundaries.find((b) => b.id === id)?.label ?? "—";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <h3 className="font-medium">Map a threat vector</h3>
        <div className="space-y-1.5">
          <Label>Trust boundary</Label>
          <Select
            value={form.trustBoundaryId}
            onChange={(e) => setForm((f) => ({ ...f, trustBoundaryId: e.target.value }))}
          >
            {boundaries.length === 0 ? <option value="">No boundaries — add one first</option> : null}
            {boundaries.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Tool poisoning via schema injection"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>STRIDE category</Label>
            <Select
              value={form.strideCategory}
              onChange={(e) => setForm((f) => ({ ...f, strideCategory: e.target.value }))}
            >
              {STRIDE_CATEGORIES.map((s) => (
                <option key={s} value={s}>
                  {STRIDE_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>MCP category</Label>
            <Select
              value={form.mcpCategory}
              onChange={(e) => setForm((f) => ({ ...f, mcpCategory: e.target.value }))}
            >
              {MCP_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {MCP_CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Likelihood</Label>
            <Select
              value={form.likelihood}
              onChange={(e) => setForm((f) => ({ ...f, likelihood: e.target.value }))}
            >
              {RISK_LEVELS.map((r) => (
                <option key={r} value={r}>
                  {RISK_LEVEL_LABELS[r]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Impact</Label>
            <Select
              value={form.impact}
              onChange={(e) => setForm((f) => ({ ...f, impact: e.target.value }))}
            >
              {RISK_LEVELS.map((r) => (
                <option key={r} value={r}>
                  {RISK_LEVEL_LABELS[r]}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <Button onClick={add} disabled={busy || boundaries.length === 0}>
          <Plus className="size-4" /> Map vector
        </Button>

        <KnowledgePanel category={form.mcpCategory as McpCategory} className="mt-2" />
      </div>

      <div className="space-y-2">
        <h3 className="font-medium">
          Mapped vectors <span className="text-muted-foreground">({vectors.length})</span>
        </h3>
        {vectors.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="No vectors mapped"
            description="Map threat vectors to your boundaries using the form on the left."
          />
        ) : (
          <div className="space-y-2">
            {vectors.map((v) => (
              <div key={v.id} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{v.title}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <StrideBadge category={v.strideCategory} />
                      <McpCategoryBadge category={v.mcpCategory} />
                      <RiskBadge level={v.likelihood} prefix="L" />
                      <RiskBadge level={v.impact} prefix="I" />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Boundary: {boundaryLabel(v.trustBoundaryId)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => del(v.id)}
                    aria-label="Delete vector"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
