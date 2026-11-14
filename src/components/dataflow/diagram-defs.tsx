import { RED, edgeStroke } from "./geometry";

/** Arrowheads for normal, trust-boundary-crossing and highlighted flows. */
export function DiagramDefs() {
  return (
    <defs>
      <marker id="dfd-end" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto">
        <path d="M0,0 L6.5,3 L0,6 z" style={{ fill: edgeStroke }} />
      </marker>
      <marker id="dfd-red" markerWidth="10" markerHeight="10" refX="7" refY="3.5" orient="auto">
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
  );
}
