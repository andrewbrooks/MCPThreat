import type { DataflowNode } from "@/lib/dataflow";

export const NODE_W = 184;
export const NODE_H = 66;
const COL_GAP = 288; // horizontal distance between tiers
const ROW_GAP = 128; // vertical distance between nodes in a tier
const MARGIN_X = 48;
const MARGIN_Y = 60;
export const VIEWPORT_H = 500; // px height of the scroll/zoom viewport
export const RED = "#E24B4A";

export const MIN_SCALE = 0.4;
export const MAX_SCALE = 3;

// Outlines use muted-foreground / accent-foreground (not the very light --border)
// so the boxes read clearly against the card in both light and dark themes.
export const zoneStyle = {
  fill: "hsl(var(--muted))",
  stroke: "hsl(var(--muted-foreground) / 0.7)",
};
export const processStyle = {
  fill: "hsl(var(--accent) / 0.15)",
  stroke: "hsl(var(--accent-foreground) / 0.6)",
};
export const storeStyle = {
  fill: "hsl(var(--secondary))",
  stroke: "hsl(var(--muted-foreground) / 0.7)",
};
export const edgeStroke = "hsl(var(--muted-foreground) / 0.6)";
export const cardBg = "hsl(var(--card))";

export function styleFor(type: DataflowNode["type"]) {
  if (type === "process") return processStyle;
  if (type === "datastore") return storeStyle;
  return zoneStyle;
}

export function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export interface Placed {
  node: DataflowNode;
  x: number; // top-left
  y: number;
  cx: number; // center
  cy: number;
}

/** Where an edge should meet a node box — clamped to a side based on direction. */
export function anchor(p: Placed, towardX: number): { x: number; y: number } {
  const x = towardX >= p.cx ? p.x + NODE_W : p.x;
  return { x, y: p.cy };
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "dataflow"
  );
}

/** Place nodes in columns by tier, and size the canvas to fit them. */
export function layoutNodes(nodes: DataflowNode[]): {
  placed: Map<string, Placed>;
  width: number;
  height: number;
} {
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
}
