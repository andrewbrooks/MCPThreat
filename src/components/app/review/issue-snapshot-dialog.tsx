"use client";

import { Camera } from "lucide-react";
import Link from "next/link";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import type { ReadinessCheck, SnapshotRequirement } from "@/lib/workflow-types";

const NOTE_MAX = 500;

const REQUIREMENT_TEXT: Record<SnapshotRequirement, string> = {
  NONE: "The project policy does not require review, so the snapshot is recorded as issued.",
  SINGLE: "The project policy requires one reviewer other than you to approve this snapshot.",
  DUAL: "The project policy requires one assessor and one client to approve this snapshot.",
};

export function IssueSnapshotDialog({
  projectId,
  requirement,
  blockers,
  changedSinceSnapshot,
  latestVersion,
}: {
  projectId: string;
  requirement: SnapshotRequirement;
  /** Failed BLOCKER checks from the live readiness evaluation. */
  blockers: ReadinessCheck[];
  changedSinceSnapshot: boolean | null;
  latestVersion: number | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverChecks, setServerChecks] = useState<ReadinessCheck[] | null>(null);

  const shownBlockers = serverChecks ?? blockers;
  const blocked = shownBlockers.length > 0;

  function close(o: boolean) {
    if (busy) return;
    setOpen(o);
    if (!o) {
      setError(null);
      setServerChecks(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (blocked) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && Array.isArray(data.checks)) {
        setServerChecks(data.checks as ReadinessCheck[]);
        setError(data.error ?? "Some checks block issuing a snapshot.");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? `The snapshot could not be issued (HTTP ${res.status}).`);
        return;
      }
      toast("Snapshot issued.", "success");
      setOpen(false);
      setNote("");
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={() => setOpen(true)}>
        <Camera aria-hidden="true" /> Issue snapshot
      </Button>
      {changedSinceSnapshot === false ? (
        <p className="text-sm text-muted-foreground">
          The model has not changed since snapshot v{latestVersion}. Issuing another would
          duplicate it, so it is best to wait until something changes.
        </p>
      ) : changedSinceSnapshot === true ? (
        <p className="rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-950 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-100">
          The model has changed since snapshot v{latestVersion}.
        </p>
      ) : null}
      <Dialog open={open} onOpenChange={close}>
        <DialogHeader>
          <DialogTitle>Issue snapshot</DialogTitle>
          <DialogDescription>
            Issuing freezes the assessment as it is now. The snapshot cannot be edited afterwards,
            and later changes to the model do not alter it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          {blocked ? (
            <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-950 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100">
              <p className="font-medium">These checks block issuing a snapshot.</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {shownBlockers.map((c) => (
                  <li key={c.id} className="break-words">
                    {c.title}{" "}
                    <Link
                      href={`/projects/${projectId}${c.href}`}
                      className="underline underline-offset-2"
                    >
                      Go to fix<span className="sr-only">: {c.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="snapshot-note">Note (optional)</Label>
            <Textarea
              id="snapshot-note"
              value={note}
              maxLength={NOTE_MAX}
              onChange={(e) => setNote(e.target.value)}
              disabled={busy}
              aria-describedby="snapshot-note-help"
              placeholder="For example, the reason for this snapshot"
            />
            <p id="snapshot-note-help" className="text-xs text-muted-foreground">
              {note.length} of {NOTE_MAX} characters.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">{REQUIREMENT_TEXT[requirement]}</p>
          {error ? (
            <p
              role="alert"
              className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-950 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100"
            >
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || blocked}>
              {busy ? "Issuing snapshot…" : "Issue snapshot"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
