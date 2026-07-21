import * as React from "react";
import { cn } from "@/lib/utils";

// Lightweight CSS hover/focus tooltip. Wrap a trigger; `content` shows on hover or
// keyboard focus. No JS state, so it works in server components too.
export function Tooltip({
  content,
  children,
  side = "top",
  className,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "right";
  className?: string;
}) {
  return (
    <span className="group/tt relative inline-flex" tabIndex={0}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 hidden w-64 rounded-md border bg-popover p-2 text-xs font-normal leading-snug text-popover-foreground shadow-md group-hover/tt:block group-focus/tt:block",
          side === "top" && "bottom-full left-1/2 mb-2 -translate-x-1/2",
          side === "bottom" && "top-full left-1/2 mt-2 -translate-x-1/2",
          side === "right" && "left-full top-1/2 ml-2 -translate-y-1/2",
          className,
        )}
      >
        {content}
      </span>
    </span>
  );
}
