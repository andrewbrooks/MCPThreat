"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { DiagramDefs } from "@/components/dataflow/diagram-defs";
import { DiagramEdge } from "@/components/dataflow/diagram-edge";
import { DiagramLegend } from "@/components/dataflow/legend";
import { DiagramNode } from "@/components/dataflow/diagram-node";
import { exportDiagramSvg } from "@/components/dataflow/export-svg";
import { MAX_SCALE, MIN_SCALE, VIEWPORT_H, layoutNodes } from "@/components/dataflow/geometry";
import { ZoomControls } from "@/components/dataflow/zoom-controls";
import type { Dataflow } from "@/lib/dataflow";

// Interactive layered data-flow diagram (DFD), in the same theme-safe SVG style as
// TrustBoundaryMap: hsl(var(--…)) fills + currentColor text so it reads in both
// light and dark. Nodes are laid out left→right by `tier`; flows that cross a trust
// boundary are drawn dashed + red. Pan by dragging; zoom with the buttons or wheel.
// The pieces (geometry, edges, nodes, controls, export) live in components/dataflow/.

export function DataflowDiagram({
  dataflow,
  filename = "dataflow",
  activeId = null,
  pinnedId = null,
  onPreview,
  onTogglePin,
  onClear,
}: {
  dataflow: Dataflow;
  filename?: string;
  activeId?: string | null;
  pinnedId?: string | null;
  onPreview?: (id: string | null) => void;
  onTogglePin?: (id: string) => void;
  onClear?: () => void;
}) {
  const { nodes, edges } = dataflow;
  const svgRef = useRef<SVGSVGElement>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [panning, setPanning] = useState(false);
  const drag = useRef<{ x0: number; y0: number; tx0: number; ty0: number } | null>(null);
  const moved = useRef(false);
  const activeEdge = activeId ? edges.find((e) => e.id === activeId) : undefined;
  const hasActive = !!activeEdge;

  const { placed, width, height } = useMemo(() => layoutNodes(nodes), [nodes]);

  // Map a client (screen) point into the SVG viewBox coordinate space.
  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }, []);

  const zoomTo = useCallback((nextScale: number, center?: { x: number; y: number }) => {
    const s2 = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
    setScale((s) => {
      if (center) {
        // Keep the world point under `center` fixed while scaling.
        setTx((t) => center.x - ((center.x - t) / s) * s2);
        setTy((t) => center.y - ((center.y - t) / s) * s2);
      }
      return s2;
    });
  }, []);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const center = clientToSvg(e.clientX, e.clientY);
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    zoomTo(scale * factor, center);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    moved.current = false;
    // Edges are click targets, so they do not start a pan.
    if ((e.target as Element).closest("[data-flow]")) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x0: e.clientX, y0: e.clientY, tx0: tx, ty0: ty };
    setPanning(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    if (Math.abs(e.clientX - drag.current.x0) + Math.abs(e.clientY - drag.current.y0) > 4) {
      moved.current = true;
    }
    const svg = svgRef.current;
    if (!svg) return;
    // Convert the client-pixel delta into viewBox units so panning tracks the cursor.
    const scaleX = svg.viewBox.baseVal.width / svg.clientWidth || 1;
    const scaleY = svg.viewBox.baseVal.height / svg.clientHeight || 1;
    setTx(drag.current.tx0 + (e.clientX - drag.current.x0) * scaleX);
    setTy(drag.current.ty0 + (e.clientY - drag.current.y0) * scaleY);
  };
  const endDrag = () => {
    drag.current = null;
    setPanning(false);
  };

  const onSvgClick = (e: React.MouseEvent) => {
    const t = e.target as Element;
    if (moved.current || t.closest("[data-flow]") || t.closest("[data-node]")) return;
    onClear?.();
  };

  const reset = () => {
    setScale(1);
    setTx(0);
    setTy(0);
  };

  const exportSvg = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    exportDiagramSvg(svg, width, height, filename);
  }, [width, height, filename]);

  return (
    <div>
      <div className="relative overflow-hidden rounded-md border bg-card">
        <ZoomControls
          zoomIn={() => zoomTo(scale * 1.2, { x: width / 2, y: height / 2 })}
          zoomOut={() => zoomTo(scale / 1.2, { x: width / 2, y: height / 2 })}
          reset={reset}
          exportSvg={exportSvg}
        />

        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          style={{
            height: VIEWPORT_H,
            touchAction: "none",
            cursor: panning ? "grabbing" : "grab",
          }}
          className="block text-foreground"
          role="group"
          aria-label="Application data-flow diagram; drag to pan, scroll or use the buttons to zoom"
          onClick={onSvgClick}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
        >
          <DiagramDefs />

          <g id="dfd-export-root" transform={`translate(${tx} ${ty}) scale(${scale})`}>
            {/* Edges (drawn first, under nodes) */}
            {edges.map((e) => {
              const from = placed.get(e.from);
              const to = placed.get(e.to);
              if (!from || !to) return null;
              return (
                <DiagramEdge
                  key={e.id}
                  e={e}
                  from={from}
                  to={to}
                  isActive={activeId === e.id}
                  hasActive={hasActive}
                  pinnedId={pinnedId}
                  onPreview={onPreview}
                  onTogglePin={onTogglePin}
                />
              );
            })}

            {/* Nodes */}
            {[...placed.values()].map((placedNode) => (
              <DiagramNode
                key={placedNode.node.id}
                placedNode={placedNode}
                activeEdge={activeEdge}
                hasActive={hasActive}
              />
            ))}
          </g>
        </svg>
      </div>

      <DiagramLegend />
    </div>
  );
}
