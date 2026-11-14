import { Download, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Zoom, reset and export buttons, overlaid on the diagram's corner. */
export function ZoomControls({
  zoomIn,
  zoomOut,
  reset,
  exportSvg,
}: {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  exportSvg: () => void;
}) {
  return (
    <div className="absolute right-2 top-2 z-10 flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-8 bg-background/90"
        onClick={zoomIn}
        aria-label="Zoom in"
      >
        <ZoomIn className="size-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-8 bg-background/90"
        onClick={zoomOut}
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
  );
}
