"use client";

import { CheckCircle2, ShieldCheck, ShieldQuestion } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { acceptanceRequirement } from "@/lib/acceptance";
import { PARTY_SIDE_LABELS, type PartySide } from "@/lib/taxonomy";

export interface AcceptanceInfo {
  id: string;
  status: string;
  requireBothSides: boolean;
  justification: string;
  residualRisk: string;
  requestedById: string | null;
  requestedByLabel: string;
  assessorApproverLabel: string | null;
  assessorApprovedAt: string | null;
  clientApproverLabel: string | null;
  clientApprovedAt: string | null;
  reviewIntervalDays: number | null;
  expiresAt: string | null;
  rejectedByLabel?: string | null;
  rejectedReason?: string | null;
}

interface Props {
  projectId: string;
  findingId: string;
  status: string;
  severity: string;
  acceptancePolicy: string;
  viewerSide: PartySide;
  viewerId: string | null;
  acceptance: AcceptanceInfo | null;
  onChanged: () => void;
}

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "—";
}

export function AcceptancePanel({
  projectId,
  findingId,
  status,
  severity,
  acceptancePolicy,
  viewerSide,
  viewerId,
  acceptance,
  onChanged,
}: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [justification, setJustification] = useState("");
  const [residualRisk, setResidualRisk] = useState("");
  const [interval, setInterval] = useState("");
  const [comment, setComment] = useState("");

  if (acceptancePolicy === "OFF") return null;

  const requirement = acceptanceRequirement(acceptancePolicy, severity);
  const base = `/api/projects/${projectId}/findings/${findingId}/acceptance`;

  async function post(url: string, body?: unknown, method = "POST") {
    setBusy(true);
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast(data.error ?? "Action failed.", "error");
      return false;
    }
    return true;
  }

  async function submitRequest() {
    if (!justification.trim()) {
      toast("A justification is required.", "error");
      return;
    }
    const ok = await post(base, {
      justification,
      residualRisk,
      reviewIntervalDays: interval ? Number(interval) : null,
    });
    if (ok) {
      toast("Acceptance requested.", "success");
      setRequesting(false);
      setJustification("");
      setResidualRisk("");
      setInterval("");
      onChanged();
    }
  }

  async function decide(decision: "APPROVE" | "REJECT") {
    const ok = await post(`${base}/decision`, { decision, comment });
    if (ok) {
      toast(decision === "APPROVE" ? "Sign-off recorded." : "Request rejected.", "success");
      setComment("");
      onChanged();
    }
  }

  async function cancel() {
    const ok = await post(base, undefined, "DELETE");
    if (ok) {
      toast("Request cancelled.", "success");
      onChanged();
    }
  }

  // --- Accepted summary -----------------------------------------------------
  if (status === "ACCEPTED") {
    return (
      <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
        <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          <ShieldCheck className="size-4" /> Risk accepted
        </div>
        <div className="text-xs text-muted-foreground">
          {acceptance?.assessorApprovedAt ? (
            <div>
              Assessor sign-off: {acceptance.assessorApproverLabel} ·{" "}
              {fmtDate(acceptance.assessorApprovedAt)}
            </div>
          ) : null}
          {acceptance?.clientApprovedAt ? (
            <div>
              Client sign-off: {acceptance.clientApproverLabel} · {fmtDate(acceptance.clientApprovedAt)}
            </div>
          ) : null}
          {acceptance?.expiresAt ? (
            <div>Acceptance expires: {fmtDate(acceptance.expiresAt)}</div>
          ) : null}
          {acceptance?.justification ? (
            <div className="mt-1">Justification: {acceptance.justification}</div>
          ) : null}
        </div>
      </div>
    );
  }

  // --- Pending request ------------------------------------------------------
  if (status === "PENDING_ACCEPTANCE" && acceptance?.status === "PENDING") {
    const mySlotSigned =
      (viewerSide === "ASSESSOR" && acceptance.assessorApprovedAt) ||
      (viewerSide === "CLIENT" && acceptance.clientApprovedAt);
    const isRequester = viewerId != null && viewerId === acceptance.requestedById;
    const canApprove =
      !mySlotSigned && (acceptance.requireBothSides || !isRequester);

    return (
      <div className="space-y-3 rounded-md border border-violet-200 bg-violet-50 p-3 dark:border-violet-500/30 dark:bg-violet-500/10">
        <div className="flex items-center gap-1.5 text-sm font-medium text-violet-700 dark:text-violet-300">
          <ShieldQuestion className="size-4" /> Acceptance pending
        </div>
        <div className="text-xs text-muted-foreground">
          Requested by {acceptance.requestedByLabel}. Justification: {acceptance.justification}
          {acceptance.residualRisk ? ` · Residual risk: ${acceptance.residualRisk}` : ""}
        </div>

        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-1.5">
            {acceptance.assessorApprovedAt ? (
              <CheckCircle2 className="size-3.5 text-emerald-500" />
            ) : (
              <span className="size-3.5 rounded-full border" />
            )}
            Assessor:{" "}
            {acceptance.assessorApprovedAt
              ? `${acceptance.assessorApproverLabel} (${fmtDate(acceptance.assessorApprovedAt)})`
              : "awaiting sign-off"}
          </div>
          {acceptance.requireBothSides ? (
            <div className="flex items-center gap-1.5">
              {acceptance.clientApprovedAt ? (
                <CheckCircle2 className="size-3.5 text-emerald-500" />
              ) : (
                <span className="size-3.5 rounded-full border" />
              )}
              Client:{" "}
              {acceptance.clientApprovedAt
                ? `${acceptance.clientApproverLabel} (${fmtDate(acceptance.clientApprovedAt)})`
                : "awaiting sign-off"}
            </div>
          ) : null}
        </div>

        {canApprove ? (
          <Textarea
            className="min-h-[52px] text-sm"
            placeholder="Optional comment for the record…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        ) : null}

        <div className="flex flex-wrap gap-2">
          {canApprove ? (
            <Button size="sm" onClick={() => decide("APPROVE")} disabled={busy}>
              Approve as {PARTY_SIDE_LABELS[viewerSide]}
            </Button>
          ) : mySlotSigned ? (
            <span className="text-xs text-muted-foreground">
              You’ve signed off — awaiting the other party.
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              You requested this; another approver must sign off.
            </span>
          )}
          <Button size="sm" variant="outline" onClick={() => decide("REJECT")} disabled={busy}>
            Reject
          </Button>
          {isRequester ? (
            <Button size="sm" variant="ghost" onClick={cancel} disabled={busy}>
              Cancel request
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  // --- No active request: offer to request acceptance -----------------------
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="text-sm font-medium">Risk acceptance</div>
      <p className="text-xs text-muted-foreground">
        {requirement === "DUAL"
          ? "This finding needs one assessor and one client sign-off to be accepted."
          : "Accepting this finding needs one approval from someone other than the requester."}
      </p>
      {requesting ? (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">Justification</Label>
            <Textarea
              className="min-h-[60px]"
              placeholder="Why is this risk being accepted?"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Residual risk (optional)</Label>
            <Textarea
              className="min-h-[44px]"
              value={residualRisk}
              onChange={(e) => setResidualRisk(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Acceptance expires (reopens for review)</Label>
            <Select value={interval} onChange={(e) => setInterval(e.target.value)} className="w-48">
              <option value="">No expiry</option>
              <option value="30">In 30 days</option>
              <option value="60">In 60 days</option>
              <option value="90">In 90 days</option>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={submitRequest} disabled={busy}>
              Submit request
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRequesting(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setRequesting(true)}>
          Request acceptance
        </Button>
      )}
    </div>
  );
}
