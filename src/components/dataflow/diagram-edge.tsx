import type { DataflowEdge } from "@/lib/dataflow";
import { RED, anchor, cardBg, edgeStroke, truncate, type Placed } from "./geometry";

/** One flow: its line, highlight, hit area and label, as a keyboard-focusable control. */
export function DiagramEdge({
  e,
  from,
  to,
  isActive,
  hasActive,
  pinnedId,
  onPreview,
  onTogglePin,
}: {
  e: DataflowEdge;
  from: Placed;
  to: Placed;
  isActive: boolean;
  hasActive: boolean;
  pinnedId: string | null;
  onPreview?: (id: string | null) => void;
  onTogglePin?: (id: string) => void;
}) {
  const a = anchor(from, to.cx);
  const b = anchor(to, from.cx);
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  const crossing = e.crossesBoundary;
  const labelText = truncate([e.label, e.dataClass].filter(Boolean).join(" · "), 30);
  const baseWidth = crossing ? 1.8 : 1.5;
  const baseStroke = crossing ? RED : edgeStroke;
  const baseMarker = crossing ? "url(#dfd-red)" : "url(#dfd-end)";
  const fromLabel = from.node.label;
  const toLabel = to.node.label;
  const fullLabel = [e.label, e.dataClass].filter(Boolean).join(" · ");
  const name = `Flow: ${fromLabel} to ${toLabel}${fullLabel ? `: ${fullLabel}` : ""}`;
  return (
    <g
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
          fill={isActive ? "currentColor" : crossing ? RED : "hsl(var(--muted-foreground))"}
        >
          {labelText}
        </text>
      ) : null}
    </g>
  );
}
