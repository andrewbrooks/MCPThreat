import {
  DATAFLOW_NODE_TYPE_LABELS,
  type Dataflow,
  type DataflowNode,
} from "@/lib/dataflow";

// Hand-built layered data-flow diagram (DFD), in the same theme-safe SVG style as
// TrustBoundaryMap: hsl(var(--…)) fills + currentColor text so it reads in both
// light and dark. Nodes are laid out left→right by `tier`; flows that cross a trust
// boundary are drawn dashed + red. Pure render — no client interactivity.

const NODE_W = 156;
const NODE_H = 52;
const COL_GAP = 220; // horizontal distance between tiers
const ROW_GAP = 82; // vertical distance between nodes in a tier
const MARGIN_X = 24;
const MARGIN_Y = 44;
const RED = "#E24B4A";

const zoneStyle = { fill: "hsl(var(--muted))", stroke: "hsl(var(--border))" };
const processStyle = { fill: "hsl(var(--accent) / 0.12)", stroke: "hsl(var(--accent) / 0.5)" };
const storeStyle = { fill: "hsl(var(--secondary))", stroke: "hsl(var(--border))" };
const edgeStroke = "hsl(var(--muted-foreground) / 0.6)";

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

export function DataflowDiagram({ dataflow }: { dataflow: Dataflow }) {
  const { nodes, edges } = dataflow;

  // Group by tier, then stack within each tier column.
  const tiers = [...new Set(nodes.map((n) => n.tier))].sort((a, b) => a - b);
  const byTier = new Map<number, DataflowNode[]>();
  for (const n of nodes) {
    const arr = byTier.get(n.tier) ?? [];
    arr.push(n);
    byTier.set(n.tier, arr);
  }

  const placed = new Map<string, Placed>();
  let maxRows = 0;
  tiers.forEach((tier, col) => {
    const group = byTier.get(tier) ?? [];
    maxRows = Math.max(maxRows, group.length);
    group.forEach((node, row) => {
      const x = MARGIN_X + col * COL_GAP;
      const y = MARGIN_Y + row * ROW_GAP;
      placed.set(node.id, { node, x, y, cx: x + NODE_W / 2, cy: y + NODE_H / 2 });
    });
  });

  const width = MARGIN_X * 2 + Math.max(1, tiers.length) * COL_GAP - (COL_GAP - NODE_W);
  const height = MARGIN_Y * 2 + Math.max(1, maxRows) * ROW_GAP - (ROW_GAP - NODE_H);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ minWidth: Math.min(width, 720) }}
        className="block h-auto rounded-md border bg-card text-foreground"
        role="img"
        aria-label="Application data-flow diagram"
      >
        <defs>
          <marker id="dfd-end" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto">
            <path d="M0,0 L6.5,3 L0,6 z" style={{ fill: edgeStroke }} />
          </marker>
          <marker id="dfd-red" markerWidth="10" markerHeight="10" refX="7" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 z" fill={RED} />
          </marker>
        </defs>

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
          return (
            <g key={e.id}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                fill="none"
                strokeWidth={crossing ? 1.6 : 1.4}
                stroke={crossing ? RED : edgeStroke}
                strokeDasharray={crossing ? "6 4" : undefined}
                markerEnd={crossing ? "url(#dfd-red)" : "url(#dfd-end)"}
              />
              {e.label || e.dataClass ? (
                <text
                  x={midX}
                  y={midY - 4}
                  textAnchor="middle"
                  style={{ fontSize: "10px", fontWeight: 500 }}
                  fill={crossing ? RED : "hsl(var(--muted-foreground))"}
                >
                  {truncate([e.label, e.dataClass].filter(Boolean).join(" · "), 26)}
                </text>
              ) : null}
            </g>
          );
        })}

        {/* Nodes */}
        {[...placed.values()].map(({ node, x, y }) => {
          const s = styleFor(node.type);
          const isProcess = node.type === "process";
          return (
            <g key={node.id}>
              <rect
                x={x}
                y={y}
                width={NODE_W}
                height={NODE_H}
                rx={isProcess ? NODE_H / 2 : 3}
                strokeWidth={1.4}
                style={s}
              />
              {/* Datastore hint: an inner left bar, evoking the classic open store. */}
              {node.type === "datastore" ? (
                <line
                  x1={x + 8}
                  y1={y + 6}
                  x2={x + 8}
                  y2={y + NODE_H - 6}
                  stroke="hsl(var(--border))"
                  strokeWidth={1.2}
                />
              ) : null}
              <text
                x={x + NODE_W / 2}
                y={y + NODE_H / 2 - 3}
                textAnchor="middle"
                style={{ fontSize: "12px", fontWeight: 600 }}
                fill="currentColor"
              >
                {truncate(node.label, 22)}
                <title>{node.label}</title>
              </text>
              <text
                x={x + NODE_W / 2}
                y={y + NODE_H / 2 + 12}
                textAnchor="middle"
                style={{ fontSize: "9px", fontWeight: 500, letterSpacing: "0.03em" }}
                fill="hsl(var(--muted-foreground))"
              >
                {DATAFLOW_NODE_TYPE_LABELS[node.type].toUpperCase()}
                {node.trustZone ? ` · ${truncate(node.trustZone, 16)}` : ""}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-4 rounded-sm border" style={zoneStyle} /> External entity
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
      </div>
    </div>
  );
}
