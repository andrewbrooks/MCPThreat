import { edgeStroke, slugify } from "./geometry";

/** Export the full diagram as a self-contained SVG file download. */
export function exportDiagramSvg(
  svg: SVGSVGElement,
  width: number,
  height: number,
  filename: string,
): void {
  // Export the full diagram as a self-contained SVG. The live SVG references
  // theme CSS variables (hsl(var(--…))) and currentColor, which don't resolve
  // outside the app — so we clone it, reset pan/zoom, add a background, and
  // substitute each variable with its computed color before serializing.
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
}
