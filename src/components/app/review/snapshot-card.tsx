"use client";

import { Check, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { utc } from "@/lib/report-format";
import { canSignOff, statusLabel } from "@/lib/signoff";
import type { PartySide } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";
import type { SnapshotStatus, SnapshotSummary } from "@/lib/workflow-types";

const STATUS_TONE: Record<SnapshotStatus, string> = {
  ISSUED: "border-border bg-muted text-foreground",
  PENDING:
    "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100",
  APPROVED:
    "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100",
  RETURNED:
    "border-red-300 bg-red-50 text-red-950 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100",
};

const FORMATS: { format: string; label: string }[] = [
  { format: "html", label: "HTML" },
  { format: "md", label: "Markdown" },
  { format: "json", label: "JSON" },
  { format: "csv", label: "Findings CSV" },
];

function HashCopy({ hash, version }: { hash: string; version: number }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      toast("SHA-256 hash copied.", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Could not copy. Select the hash text instead.", "error");
    }
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <code className="break-all rounded-sm bg-muted px-1.5 py-0.5 text-xs">
        {hash.slice(0, 12)}
      </code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={copy}
      >
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied ? (
          "Copied"
        ) : (
          <>
            Copy hash<span className="sr-only"> (full SHA-256) of snapshot v{version}</span>
          </>
        )}
      </Button>
    </span>
  );
}

function SignoffPanel({
  projectId,
  snapshot,
}: {
  projectId: string;
  snapshot: SnapshotSummary;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<"APPROVE" | "RETURN" | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = `signoff-${snapshot.id}`;

  async function decide(decision: "APPROVE" | "RETURN") {
    setError(null);
    if (decision === "RETURN" && !comment.trim()) {
      setFieldError("Explain what needs to change when returning a snapshot.");
      return;
    }
    setFieldError(null);
    setBusy(decision);
    try {
      const res = await fetch(`/api/projects/${projectId}/snapshots/${snapshot.id}/signoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment: comment.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `The decision could not be recorded (HTTP ${res.status}).`);
        return;
      }
      toast(decision === "APPROVE" ? "Approval recorded." : "Snapshot returned for changes.", "success");
      setComment("");
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 space-y-2 rounded-md border bg-muted/40 p-3">
      <h4 className="text-sm font-semibold">Your sign-off</h4>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-comment`}>Comment (required when returning)</Label>
        <Textarea
          id={`${id}-comment`}
          value={comment}
          maxLength={2000}
          onChange={(e) => setComment(e.target.value)}
          disabled={busy !== null}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? `${id}-comment-error` : undefined}
        />
        {fieldError ? (
          <p id={`${id}-comment-error`} className="text-sm text-red-800 dark:text-red-300">
            {fieldError}
          </p>
        ) : null}
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-950 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100"
        >
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => decide("APPROVE")} disabled={busy !== null}>
          {busy === "APPROVE" ? "Recording approval…" : "Approve"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => decide("RETURN")}
          disabled={busy !== null}
        >
          {busy === "RETURN" ? "Returning…" : "Return for changes"}
        </Button>
      </div>
    </div>
  );
}

export function SnapshotCard({
  projectId,
  snapshot,
  canWrite,
  viewerId,
  viewerSide,
}: {
  projectId: string;
  snapshot: SnapshotSummary;
  canWrite: boolean;
  viewerId: string;
  viewerSide: PartySide;
}) {
  const base = `/api/projects/${projectId}/snapshots/${snapshot.id}/report`;
  const headingId = `snapshot-${snapshot.id}-heading`;

  // The same rules the API enforces (src/lib/signoff.ts), so the page only offers what
  // the server will accept. The server remains the authority.
  const decision = canSignOff(
    snapshot.requirement,
    snapshot.signoffs.map((s) => ({ side: s.side, decision: s.decision, userId: s.userId })),
    { userId: viewerId, side: viewerSide },
    snapshot.createdById,
  );

  return (
    <li className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={headingId} className="text-base font-semibold">
          Snapshot v{snapshot.version}
        </h3>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
            STATUS_TONE[snapshot.status],
          )}
        >
          {statusLabel(snapshot.status)}
        </span>
        {snapshot.superseded ? (
          <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Superseded
          </span>
        ) : null}
      </div>
      <p className="mt-2 break-words text-sm text-muted-foreground">
        Issued by <span className="break-all">{snapshot.createdBy}</span> on{" "}
        {utc(snapshot.createdAt)}
      </p>
      {snapshot.note ? <p className="mt-2 break-words text-sm">{snapshot.note}</p> : null}
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">SHA-256</span>
        <HashCopy hash={snapshot.contentHash} version={snapshot.version} />
      </p>

      {snapshot.signoffs.length > 0 ? (
        <div className="mt-3">
          <h4 className="text-sm font-semibold">Sign-offs</h4>
          <ul className="mt-1 space-y-1.5 text-sm">
            {snapshot.signoffs.map((s, i) => (
              <li key={`${s.side}-${i}`} className="break-words">
                <span className="font-medium">
                  {s.side === "ASSESSOR" ? "Assessor" : "Client"}{" "}
                  {s.decision === "APPROVED" ? "approved" : "returned for changes"}
                </span>{" "}
                by <span className="break-all">{s.by}</span> on {utc(s.at)}
                {s.comment ? (
                  <span className="block text-muted-foreground">&quot;{s.comment}&quot;</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {snapshot.status === "PENDING" && snapshot.awaiting.length > 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Still needed: {snapshot.awaiting.join(" and ")}.
        </p>
      ) : null}

      {canWrite && decision.ok ? (
        <SignoffPanel projectId={projectId} snapshot={snapshot} />
      ) : snapshot.status === "PENDING" && !decision.ok ? (
        <p className="mt-3 text-sm text-muted-foreground">{decision.reason}</p>
      ) : null}

      <div
        className="mt-4 flex flex-wrap gap-2"
        role="group"
        aria-label={`Downloads for snapshot v${snapshot.version}`}
      >
        {FORMATS.map((f) => (
          <a
            key={f.format}
            href={`${base}?format=${f.format}&download=1`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <span className="sr-only">Download v{snapshot.version} as </span>
            {f.label}
          </a>
        ))}
        <a
          href={`${base}?format=html`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          View HTML<span className="sr-only"> of v{snapshot.version} (opens in a new tab)</span>
        </a>
      </div>
    </li>
  );
}
