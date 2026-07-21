"use client";

import { Info, Trash2, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import {
  PARTY_SIDES,
  PARTY_SIDE_LABELS,
  PROJECT_ROLES,
  PROJECT_ROLE_DESCRIPTIONS,
  PROJECT_ROLE_LABELS,
  type PartySide,
  type ProjectRole,
} from "@/lib/taxonomy";

interface Member {
  id: string;
  email: string;
  role: string;
  side: string;
  userId: string | null;
}
interface ProjectOption {
  id: string;
  name: string;
}

// Roles that can be assigned when inviting (OWNER is implicit to the creator).
const INVITABLE_ROLES = PROJECT_ROLES.filter((r) => r !== "OWNER") as ProjectRole[];

function RoleLegend() {
  return (
    <div className="space-y-1.5">
      {INVITABLE_ROLES.map((r) => (
        <div key={r}>
          <span className="font-medium text-foreground">{PROJECT_ROLE_LABELS[r]}</span>
          {" — "}
          {PROJECT_ROLE_DESCRIPTIONS[r]}
        </div>
      ))}
    </div>
  );
}

export function MembersManager({ projects }: { projects: ProjectOption[] }) {
  const { toast } = useToast();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ProjectRole>("MEMBER");
  const [side, setSide] = useState<PartySide>("CLIENT");

  const load = useCallback(async (pid: string) => {
    if (!pid) return;
    setLoading(true);
    const res = await fetch(`/api/projects/${pid}/members`);
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) setMembers(data.members ?? []);
  }, []);

  useEffect(() => {
    load(projectId);
  }, [projectId, load]);

  async function invite() {
    if (!email.trim()) return;
    const res = await fetch(`/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role, side }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(data.error ?? "Failed to invite member.", "error");
      return;
    }
    toast("Member invited.", "success");
    setEmail("");
    load(projectId);
  }

  async function remove(id: string) {
    const res = await fetch(`/api/projects/${projectId}/members/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Failed to remove member.", "error");
      return;
    }
    toast("Member removed.", "success");
    load(projectId);
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        title="No projects to manage"
        description="Create a project to invite members."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Project</Label>
        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="invite-email">Invite by email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label>Role</Label>
              <Tooltip content={<RoleLegend />}>
                <Info
                  className="size-3.5 cursor-help text-muted-foreground"
                  aria-label="Role descriptions"
                />
              </Tooltip>
            </div>
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value as ProjectRole)}
              className="w-28"
            >
              {INVITABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {PROJECT_ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Side</Label>
            <Select
              value={side}
              onChange={(e) => setSide(e.target.value as PartySide)}
              className="w-28"
            >
              {PARTY_SIDES.map((s) => (
                <option key={s} value={s}>
                  {PARTY_SIDE_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={invite}>
            <UserPlus className="size-4" /> Invite
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {PROJECT_ROLE_DESCRIPTIONS[role]} Party side determines acceptance sign-off (assessor vs
          client).
        </p>
      </div>

      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members invited yet.</p>
        ) : (
          members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-md border p-2.5"
            >
              <div className="min-w-0">
                <span className="text-sm">{m.email}</span>
                {m.userId ? null : (
                  <span className="ml-2 text-xs text-muted-foreground">(pending)</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge className="border-border bg-muted text-muted-foreground">
                  {PARTY_SIDE_LABELS[m.side as PartySide] ?? m.side}
                </Badge>
                <Tooltip
                  content={
                    PROJECT_ROLE_DESCRIPTIONS[m.role as ProjectRole] ?? m.role
                  }
                >
                  <Badge className="cursor-help border-border bg-muted text-muted-foreground">
                    {PROJECT_ROLE_LABELS[m.role as ProjectRole] ?? m.role}
                  </Badge>
                </Tooltip>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(m.id)}
                  aria-label="Remove member"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
