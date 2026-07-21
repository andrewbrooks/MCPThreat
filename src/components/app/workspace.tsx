"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { BoundaryManager, type BoundaryItem } from "@/components/app/boundary-manager";
import { FindingsTable, type FindingRow, type VectorOption } from "@/components/app/findings-table";
import { VectorManager, type VectorItem } from "@/components/app/vector-manager";
import type { PartySide } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

interface WorkspaceProps {
  projectId: string;
  boundaries: BoundaryItem[];
  vectors: VectorItem[];
  findings: FindingRow[];
  vectorOptions: VectorOption[];
  stepsComplete: boolean[];
  acceptancePolicy: string;
  viewerSide: PartySide;
  viewerId: string | null;
}

const STEPS = [
  { n: 1, title: "Trust Boundaries", hint: "Define where trust changes hands" },
  { n: 2, title: "Threat Vectors", hint: "Map STRIDE + MCP threats per boundary" },
  { n: 3, title: "Findings", hint: "Record findings per vector" },
  { n: 4, title: "Review", hint: "Assign owners and due dates" },
];

export function Workspace({
  projectId,
  boundaries,
  vectors,
  findings,
  vectorOptions,
  stepsComplete,
  acceptancePolicy,
  viewerSide,
  viewerId,
}: WorkspaceProps) {
  const [step, setStep] = useState(1);

  return (
    <div className="space-y-6">
      <ol className="grid gap-2 sm:grid-cols-4">
        {STEPS.map((s) => {
          const done = stepsComplete[s.n - 1];
          const active = step === s.n;
          return (
            <li key={s.n}>
              <button
                type="button"
                onClick={() => setStep(s.n)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                  active ? "border-primary bg-primary/5" : "hover:bg-accent/40",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-medium",
                    done
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                      : active
                        ? "border-primary text-primary"
                        : "text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-4" /> : s.n}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{s.title}</span>
                  <span className="block text-xs text-muted-foreground">{s.hint}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="rounded-lg border p-4 md:p-6">
        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Step 1 · Define trust boundaries</h2>
              <p className="text-sm text-muted-foreground">
                Identify each point where data or control crosses a trust boundary in your MCP
                deployment.
              </p>
            </div>
            <BoundaryManager projectId={projectId} boundaries={boundaries} />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Step 2 · Map threat vectors</h2>
              <p className="text-sm text-muted-foreground">
                For each boundary, map the threats using STRIDE and MCP-specific categories.
                Guidance updates as you pick a category.
              </p>
            </div>
            <VectorManager
              projectId={projectId}
              boundaries={boundaries.map((b) => ({ id: b.id, label: b.label }))}
              vectors={vectors}
            />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Step 3 · Create findings</h2>
              <p className="text-sm text-muted-foreground">
                Record concrete findings against your threat vectors, with severity and
                recommendations.
              </p>
            </div>
            <FindingsTable
              projectId={projectId}
              findings={findings}
              vectors={vectorOptions}
              editable
              acceptancePolicy={acceptancePolicy}
              viewerSide={viewerSide}
              viewerId={viewerId}
            />
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Step 4 · Review &amp; assign</h2>
              <p className="text-sm text-muted-foreground">
                Assign an owner and due date to each finding, and confirm statuses. Edit a
                finding to set its owner and due date.
              </p>
            </div>
            <FindingsTable
              projectId={projectId}
              findings={findings}
              vectors={vectorOptions}
              editable
              acceptancePolicy={acceptancePolicy}
              viewerSide={viewerSide}
              viewerId={viewerId}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
