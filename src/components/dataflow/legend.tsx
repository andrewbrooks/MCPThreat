import { RED, processStyle, storeStyle, zoneStyle } from "./geometry";

export function DiagramLegend() {
  return (
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
  );
}
