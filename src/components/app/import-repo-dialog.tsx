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
export function ImportRepoDialog({
  variant = "outline",
  configured = true,
}: {
  variant?: "default" | "outline";
  /** False when the server has no ANTHROPIC_API_KEY, so the import cannot run. */
  configured?: boolean;
}) {
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
        toast(data.error ?? `Import failed (HTTP ${res.status}).`, "error");
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
      toast("Could not reach the server. Check your connection and try again.", "error");
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
            Draft a starting threat model from a GitHub repository. The draft is a starting point
            for review, not a finished assessment.
          </DialogDescription>
        </DialogHeader>
        {configured ? null : (
          <p
            role="alert"
            className="mb-4 rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
          >
            Import is not available on this server because no <code>ANTHROPIC_API_KEY</code> is
            set. Manual threat modeling is not affected. See the README for setup.
          </p>
        )}
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="repoUrl">Repository URL</Label>
            <Input
              id="repoUrl"
              type="url"
              required
              aria-describedby="repoUrl-help"
              placeholder="https://github.com/owner/repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              disabled={busy}
            />
            <p id="repoUrl-help" className="text-xs text-muted-foreground">
              A public repository, or a private one if you provide a token.
            </p>
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
          <div className="space-y-1 rounded-sm border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-200">
            <p className="flex items-center gap-1.5 font-medium">
              <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
              What happens when you import
            </p>
            <ul className="list-disc space-y-0.5 pl-5">
              <li>Up to 24 relevant files from github.com are fetched, and each is truncated at 24 KB.</li>
              <li>Those file contents are sent to the Anthropic API for analysis.</li>
              <li>
                Items it proposes are labelled AI-suggested, with a confidence level, and need review.
              </li>
              <li>The run is synchronous and can take up to a minute.</li>
            </ul>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !configured}>
              {busy ? "Analyzing…" : "Import and analyze"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}
