import { DATAFLOW_NODE_TYPE_LABELS, type DataflowEdge } from "@/lib/dataflow";
import { NODE_H, NODE_W, styleFor, truncate, type Placed } from "./geometry";

/** One node box (external entity, process or datastore), ringed when it is an end of the active flow. */
export function DiagramNode({
  placedNode,
  activeEdge,
  hasActive,
}: {
  placedNode: Placed;
  activeEdge: DataflowEdge | undefined;
  hasActive: boolean;
}) {
  const { node, x, y } = placedNode;
  const s = styleFor(node.type);
  const isProcess = node.type === "process";
  const isEnd = !!activeEdge && (activeEdge.from === node.id || activeEdge.to === node.id);
  return (
    <g
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
}
