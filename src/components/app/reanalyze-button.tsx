"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/** Owner-only: re-run the GitHub analysis against the project's stored repo. */
export function ReanalyzeButton({
  projectId,
  label = "Re-run analysis",
  variant = "outline",
  size = "sm",
}: {
  projectId: string;
  label?: string;
  variant?: "default" | "outline";
  size?: "default" | "sm";
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/reanalyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error ?? "Re-analysis failed.", "error");
        return;
      }
      if (data.status === "FAILED") {
        toast(data.error ?? "Analysis failed.", "error");
      } else {
        toast("Analysis refreshed.", "success");
      }
      router.refresh();
    } catch {
      toast("Network error during re-analysis.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant={variant} size={size} onClick={run} disabled={busy}>
      <RefreshCw className={busy ? "size-4 animate-spin" : "size-4"} /> {busy ? "Analyzing…" : label}
    </Button>
  );
}
