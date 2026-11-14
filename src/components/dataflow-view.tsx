"use client";

import { useCallback, useEffect, useState } from "react";
import { DataflowDiagram } from "@/components/dataflow-diagram";
import { DataflowFlowsTable, type FlowRow } from "@/components/dataflow-flows-table";
import { Card, CardContent } from "@/components/ui/card";
import type { Dataflow } from "@/lib/dataflow";

// Holds the shared "active flow" state for the diagram and the Flows table.
// `hovered` is a transient preview (hover or focus); `pinned` is set by click or
// Enter/Space. The active flow is the preview when there is one, else the pinned one.
export function DataflowView({
  dataflow,
  flows,
  filename,
}: {
  dataflow: Dataflow;
  flows: FlowRow[];
  filename: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);

  const togglePin = useCallback((id: string) => setPinned((p) => (p === id ? null : id)), []);
  const clear = useCallback(() => {
    setPinned(null);
    setHovered(null);
  }, []);

  useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clear();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pinned, clear]);

  const activeId = hovered ?? pinned;
  const shared = { activeId, pinnedId: pinned, onPreview: setHovered, onTogglePin: togglePin };

  return (
    <>
      <Card>
        <CardContent className="pt-4">
          <DataflowDiagram dataflow={dataflow} filename={filename} onClear={clear} {...shared} />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Flows</h2>
        <p className="text-sm text-muted-foreground">
          Hover or select a row to highlight that flow on the diagram. Press Escape to clear.
        </p>
        <DataflowFlowsTable flows={flows} {...shared} />
      </section>
    </>
  );
}
