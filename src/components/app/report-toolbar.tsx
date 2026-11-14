"use client";

import { Copy, Download, Printer } from "lucide-react";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const FORMATS = [
  { f: "html", label: "HTML" },
  { f: "md", label: "Markdown" },
  { f: "json", label: "JSON" },
  { f: "csv", label: "Findings CSV" },
];

/** Downloads, copy and print for the live report. The report itself is rendered by the
 *  server from the same HTML that the download produces. */
export function ReportToolbar({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const base = `/api/projects/${projectId}/report`;

  async function copy() {
    try {
      const res = await fetch(`${base}?format=md`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await navigator.clipboard.writeText(await res.text());
      setCopied(true);
      toast("Markdown copied to clipboard.", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Could not copy to the clipboard. Use the Markdown download instead.", "error");
    }
  }

  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Download report">
        <span className="text-sm text-muted-foreground">Download:</span>
        {FORMATS.map((d) => (
          <a
            key={d.f}
            href={`${base}?format=${d.f}&download=1`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Download className="size-4" aria-hidden="true" /> {d.label}
          </a>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={copy}>
          <Copy className="size-4" aria-hidden="true" /> {copied ? "Copied" : "Copy Markdown"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden="true" /> Print or save as PDF
        </Button>
      </div>
    </div>
  );
}
