"use client";

import { GitBranch, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

// Imports a public GitHub repo and bootstraps a threat model via Claude. The
// analysis runs synchronously server-side, so the dialog shows a busy state while
// the request is in flight, then navigates to the new project.
export function ImportRepoDialog({ variant = "outline" }: { variant?: "default" | "outline" }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!repoUrl.trim()) {
      toast("Enter a GitHub repository URL.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/projects/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl: repoUrl.trim(),
          token: token.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error ?? "Import failed.", "error");
        return;
      }
      if (data.status === "FAILED") {
        toast(data.error ?? "Analysis failed. Open the project to retry.", "error");
      } else {
        toast("Threat model generated. Review the AI-suggested items.", "success");
      }
      setOpen(false);
      setRepoUrl("");
      setToken("");
      if (data.projectId) {
        router.push(`/projects/${data.projectId}`);
        router.refresh();
      }
    } catch {
      toast("Network error during import.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <GitBranch className="size-4" /> Import from GitHub
      </Button>
      <Dialog open={open} onOpenChange={(o) => (busy ? null : setOpen(o))}>
        <DialogHeader>
          <DialogTitle>Import from GitHub</DialogTitle>
          <DialogDescription>
            Point MCPThreat at a public GitHub repository. Claude reads the code and
            conservatively drafts the architecture, dataflow, and AI-suggested threats for
            you to review.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="repoUrl">Repository URL</Label>
            <Input
              id="repoUrl"
              placeholder="https://github.com/owner/repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="token">GitHub token (optional)</Label>
            <Input
              id="token"
              type="password"
              placeholder="For private repos / higher rate limits"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={busy}
            />
            <p className="text-xs text-muted-foreground">
              Used only for this request and never stored.
            </p>
          </div>
          <p className="flex items-center gap-1.5 rounded-sm border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300">
            <Sparkles className="size-3.5 shrink-0" />
            Analysis is powered by Claude and may take up to a minute.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Analyzing…" : "Import & Analyze"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}
