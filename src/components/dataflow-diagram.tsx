"use client";

import { Download, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DATAFLOW_NODE_TYPE_LABELS, type Dataflow, type DataflowNode } from "@/lib/dataflow";

// Interactive layered data-flow diagram (DFD), in the same theme-safe SVG style as
// TrustBoundaryMap: hsl(var(--…)) fills + currentColor text so it reads in both
// light and dark. Nodes are laid out left→right by `tier`; flows that cross a trust
// boundary are drawn dashed + red. Pan by dragging; zoom with the buttons or wheel.

const NODE_W = 184;
const NODE_H = 66;
const COL_GAP = 288; // horizontal distance between tiers
const ROW_GAP = 128; // vertical distance between nodes in a tier
const MARGIN_X = 48;
const MARGIN_Y = 60;
const VIEWPORT_H = 500; // px height of the scroll/zoom viewport
const RED = "#E24B4A";

const MIN_SCALE = 0.4;
const MAX_SCALE = 3;

// Outlines use muted-foreground / accent-foreground (not the very light --border)
// so the boxes read clearly against the card in both light and dark themes.
const zoneStyle = { fill: "hsl(var(--muted))", stroke: "hsl(var(--muted-foreground) / 0.7)" };
const processStyle = {
  fill: "hsl(var(--accent) / 0.15)",
  stroke: "hsl(var(--accent-foreground) / 0.6)",
};
const storeStyle = { fill: "hsl(var(--secondary))", stroke: "hsl(var(--muted-foreground) / 0.7)" };
const edgeStroke = "hsl(var(--muted-foreground) / 0.6)";
const cardBg = "hsl(var(--card))";

function styleFor(type: DataflowNode["type"]) {
  if (type === "process") return processStyle;
  if (type === "datastore") return storeStyle;
  return zoneStyle;
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

interface Placed {
  node: DataflowNode;
  x: number; // top-left
  y: number;
  cx: number; // center
  cy: number;
}

/** Where an edge should meet a node box — clamped to a side based on direction. */
function anchor(p: Placed, towardX: number): { x: number; y: number } {
  const x = towardX >= p.cx ? p.x + NODE_W : p.x;
  return { x, y: p.cy };
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "dataflow"
  );
}

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
  const drag = useRef<{ x0: number; y0: number; tx0: number; ty0: number } | null>(null);
  const moved = useRef(false);
  const activeEdge = activeId ? edges.find((e) => e.id === activeId) : undefined;
  const hasActive = !!activeEdge;

  const { placed, width, height } = useMemo(() => {
    const tiers = [...new Set(nodes.map((n) => n.tier))].sort((a, b) => a - b);
    const byTier = new Map<number, DataflowNode[]>();
    for (const n of nodes) {
      const arr = byTier.get(n.tier) ?? [];
      arr.push(n);
      byTier.set(n.tier, arr);
    }
    const map = new Map<string, Placed>();
    let maxRows = 0;
    tiers.forEach((tier, col) => {
      const group = byTier.get(tier) ?? [];
      maxRows = Math.max(maxRows, group.length);
      group.forEach((node, row) => {
        const x = MARGIN_X + col * COL_GAP;
        const y = MARGIN_Y + row * ROW_GAP;
        map.set(node.id, { node, x, y, cx: x + NODE_W / 2, cy: y + NODE_H / 2 });
      });
    });
    const w = MARGIN_X * 2 + Math.max(1, tiers.length) * COL_GAP - (COL_GAP - NODE_W);
    const h = MARGIN_Y * 2 + Math.max(1, maxRows) * ROW_GAP - (ROW_GAP - NODE_H);
    return { placed: map, width: w, height: h };
  }, [nodes]);

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

  // Export the full diagram as a self-contained SVG. The live SVG references
  // theme CSS variables (hsl(var(--…))) and currentColor, which don't resolve
  // outside the app — so we clone it, reset pan/zoom, add a background, and
  // substitute each variable with its computed color before serializing.
  const exportSvg = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const cs = getComputedStyle(svg);
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    clone.removeAttribute("style"); // drop viewport height + grab cursor

    // Strip all highlight and interaction state so the export is a neutral diagram.
    clone
      .querySelectorAll("[data-highlight], [data-hit], #dfd-active-marker")
      .forEach((n) => n.remove());
    clone.querySelectorAll("[data-dim]").forEach((n) => (n as SVGElement).removeAttribute("style"));
    clone.querySelectorAll("[data-base-width]").forEach((n) => {
      n.setAttribute("stroke-width", n.getAttribute("data-base-width") ?? "1.5");
      n.setAttribute("stroke", n.getAttribute("data-base-stroke") ?? edgeStroke);
      n.setAttribute("marker-end", n.getAttribute("data-base-marker") ?? "");
    });
    clone.querySelectorAll("[data-base-weight]").forEach((n) => {
      (n as SVGElement).style.fontWeight = n.getAttribute("data-base-weight") ?? "500";
      n.setAttribute("fill", n.getAttribute("data-base-fill") ?? "currentColor");
    });
    clone
      .querySelectorAll(
        "[data-flow], [data-btn], [data-node], [data-base-width], [data-base-weight], [data-dim]",
      )
      .forEach((n) => {
        for (const a of [
          "tabindex",
          "role",
          "aria-label",
          "aria-pressed",
          "class",
          "data-flow",
          "data-btn",
          "data-node",
          "data-dim",
          "aria-hidden",
        ]) {
          n.removeAttribute(a);
        }
      });
    clone.removeAttribute("role");
    clone.removeAttribute("aria-label");
    const root = clone.querySelector("#dfd-export-root");
    root?.removeAttribute("transform"); // export the whole diagram, not the pan/zoom view

    // Opaque card-colored background so the export isn't transparent.
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("width", String(width));
    bg.setAttribute("height", String(height));
    bg.setAttribute("fill", `hsl(${cs.getPropertyValue("--card").trim()})`);
    clone.insertBefore(bg, clone.firstChild);

    let out = new XMLSerializer().serializeToString(clone);
    // Longest names first is harmless; the trailing ")" already disambiguates.
    const vars = [
      "muted-foreground",
      "accent-foreground",
      "card",
      "foreground",
      "muted",
      "accent",
      "secondary",
      "border",
    ];
    for (const v of vars) {
      const val = cs.getPropertyValue(`--${v}`).trim();
      if (val) out = out.split(`var(--${v})`).join(val);
    }
    out = out.split("currentColor").join(`hsl(${cs.getPropertyValue("--foreground").trim()})`);
    out = `<?xml version="1.0" encoding="UTF-8"?>\n${out}`;

    const url = URL.createObjectURL(new Blob([out], { type: "image/svg+xml;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(filename)}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [width, height, filename]);

  return (
    <div>
      <div className="relative overflow-hidden rounded-md border bg-card">
        {/* Zoom controls */}
        <div className="absolute right-2 top-2 z-10 flex flex-col gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 bg-background/90"
            onClick={() => zoomTo(scale * 1.2, { x: width / 2, y: height / 2 })}
            aria-label="Zoom in"
          >
            <ZoomIn className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 bg-background/90"
            onClick={() => zoomTo(scale / 1.2, { x: width / 2, y: height / 2 })}
            aria-label="Zoom out"
          >
            <ZoomOut className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 bg-background/90"
            onClick={reset}
            aria-label="Reset view"
          >
            <Maximize2 className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 bg-background/90"
            onClick={exportSvg}
            aria-label="Export diagram as SVG"
            title="Export as SVG"
          >
            <Download className="size-4" />
          </Button>
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          style={{
            height: VIEWPORT_H,
            touchAction: "none",
            cursor: drag.current ? "grabbing" : "grab",
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
          <defs>
            <marker id="dfd-end" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto">
              <path d="M0,0 L6.5,3 L0,6 z" style={{ fill: edgeStroke }} />
            </marker>
            <marker
              id="dfd-red"
              markerWidth="10"
              markerHeight="10"
              refX="7"
              refY="3.5"
              orient="auto"
            >
              <path d="M0,0 L7,3.5 L0,7 z" fill={RED} />
            </marker>
            <marker
              id="dfd-active-marker"
              markerWidth="10"
              markerHeight="10"
              refX="7"
              refY="3.5"
              orient="auto"
            >
              <path d="M0,0 L7,3.5 L0,7 z" style={{ fill: "hsl(var(--primary))" }} />
            </marker>
          </defs>

          <g id="dfd-export-root" transform={`translate(${tx} ${ty}) scale(${scale})`}>
            {/* Edges (drawn first, under nodes) */}
            {edges.map((e) => {
              const from = placed.get(e.from);
              const to = placed.get(e.to);
              if (!from || !to) return null;
              const a = anchor(from, to.cx);
              const b = anchor(to, from.cx);
              const midX = (a.x + b.x) / 2;
              const midY = (a.y + b.y) / 2;
              const crossing = e.crossesBoundary;
              const labelText = truncate([e.label, e.dataClass].filter(Boolean).join(" · "), 30);
              const isActive = activeId === e.id;
              const baseWidth = crossing ? 1.8 : 1.5;
              const baseStroke = crossing ? RED : edgeStroke;
              const baseMarker = crossing ? "url(#dfd-red)" : "url(#dfd-end)";
              const fromLabel = from.node.label;
              const toLabel = to.node.label;
              const fullLabel = [e.label, e.dataClass].filter(Boolean).join(" · ");
              const name = `Flow: ${fromLabel} to ${toLabel}${fullLabel ? `: ${fullLabel}` : ""}`;
              return (
                <g
                  key={e.id}
                  data-flow={e.id}
                  data-dim=""
                  className="cursor-pointer motion-safe:transition-opacity motion-safe:duration-150"
                  style={{ opacity: hasActive && !isActive ? 0.3 : 1 }}
                  onMouseEnter={() => onPreview?.(e.id)}
                  onMouseLeave={() => onPreview?.(null)}
                  onClick={() => onTogglePin?.(e.id)}
                >
                  {/* The focusable control holds only shapes; the visible label sits beside it
                      (aria-hidden) so the accessible name matches what is announced. */}
                  <g
                    data-btn=""
                    role="button"
                    tabIndex={0}
                    aria-label={name}
                    aria-pressed={pinnedId === e.id}
                    onFocus={() => onPreview?.(e.id)}
                    onBlur={() => onPreview?.(null)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        onTogglePin?.(e.id);
                      }
                    }}
                  >
                    {isActive ? (
                      <line
                        data-highlight=""
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        strokeWidth={10}
                        strokeLinecap="round"
                        style={{ stroke: "hsl(var(--primary) / 0.22)" }}
                      />
                    ) : null}
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      fill="none"
                      data-base-width={baseWidth}
                      data-base-stroke={baseStroke}
                      data-base-marker={baseMarker}
                      strokeWidth={isActive ? 3.5 : baseWidth}
                      stroke={isActive ? "hsl(var(--primary))" : baseStroke}
                      strokeDasharray={crossing ? "6 4" : undefined}
                      markerEnd={isActive ? "url(#dfd-active-marker)" : baseMarker}
                    />
                    {/* Wide invisible hit path so thin lines are easy to hover */}
                    <line
                      data-hit=""
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="transparent"
                      strokeWidth={18}
                      style={{ pointerEvents: "stroke" }}
                    />
                  </g>
                  {labelText ? (
                    <text
                      x={midX}
                      y={midY - 6}
                      textAnchor="middle"
                      // Halo via paint-order so the label stays legible over the line.
                      stroke={cardBg}
                      strokeWidth={3}
                      paintOrder="stroke"
                      aria-hidden="true"
                      data-base-weight="500"
                      data-base-fill={crossing ? RED : "hsl(var(--muted-foreground))"}
                      style={{ fontSize: "11px", fontWeight: isActive ? 700 : 500 }}
                      fill={
                        isActive ? "currentColor" : crossing ? RED : "hsl(var(--muted-foreground))"
                      }
                    >
                      {labelText}
                    </text>
                  ) : null}
                </g>
              );
            })}

            {/* Nodes */}
            {[...placed.values()].map(({ node, x, y }) => {
              const s = styleFor(node.type);
              const isProcess = node.type === "process";
              const isEnd =
                !!activeEdge && (activeEdge.from === node.id || activeEdge.to === node.id);
              return (
                <g
                  key={node.id}
                  data-node=""
                  data-dim=""
                  className="motion-safe:transition-opacity motion-safe:duration-150"
                  style={{ opacity: hasActive && !isEnd ? 0.5 : 1 }}
                >
                  {isEnd ? (
                    <rect
                      data-highlight=""
                      x={x - 4}
                      y={y - 4}
                      width={NODE_W + 8}
                      height={NODE_H + 8}
                      rx={isProcess ? (NODE_H + 8) / 2 : 7}
                      fill="none"
                      strokeWidth={2}
                      style={{ stroke: "hsl(var(--primary) / 0.7)" }}
                    />
                  ) : null}
                  <rect
                    x={x}
                    y={y}
                    width={NODE_W}
                    height={NODE_H}
                    rx={isProcess ? NODE_H / 2 : 4}
                    strokeWidth={2}
                    style={s}
                  />
                  {node.type === "datastore" ? (
                    <line
                      x1={x + 10}
                      y1={y + 8}
                      x2={x + 10}
                      y2={y + NODE_H - 8}
                      stroke="hsl(var(--muted-foreground) / 0.7)"
                      strokeWidth={1.6}
                    />
                  ) : null}
                  <text
                    x={x + NODE_W / 2}
                    y={y + NODE_H / 2 - 4}
                    textAnchor="middle"
                    style={{ fontSize: "13px", fontWeight: 600 }}
                    fill="currentColor"
                  >
                    {truncate(node.label, 24)}
                    <title>{node.label}</title>
                  </text>
                  <text
                    x={x + NODE_W / 2}
                    y={y + NODE_H / 2 + 14}
                    textAnchor="middle"
                    style={{ fontSize: "9.5px", fontWeight: 500, letterSpacing: "0.03em" }}
                    fill="hsl(var(--muted-foreground))"
                  >
                    {DATAFLOW_NODE_TYPE_LABELS[node.type].toUpperCase()}
                    {node.trustZone ? ` · ${truncate(node.trustZone, 18)}` : ""}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-4 rounded-sm border" style={zoneStyle} /> External
          entity
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-4 rounded-full border" style={processStyle} /> Process
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-4 rounded-sm border" style={storeStyle} /> Datastore
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-6 border-t border-dashed" style={{ borderColor: RED }} />
          Crosses trust boundary
        </span>
        <span className="ml-auto text-muted-foreground">Drag to pan, scroll to zoom</span>
      </div>
    </div>
  );
}
