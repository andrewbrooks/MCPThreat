"use client";

import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export interface FlowRow {
  id: string;
  from: string;
  to: string;
  data: string;
  dataClass: string;
  crosses: boolean;
}

type SortKey = keyof Omit<FlowRow, "id">;

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "from", label: "From" },
  { key: "to", label: "To" },
  { key: "data", label: "Data" },
  { key: "dataClass", label: "Data class" },
  { key: "crosses", label: "Crosses boundary" },
];

export function DataflowFlowsTable({
  flows,
  activeId = null,
  pinnedId = null,
  onPreview,
  onTogglePin,
}: {
  flows: FlowRow[];
  activeId?: string | null;
  pinnedId?: string | null;
  onPreview?: (id: string | null) => void;
  onTogglePin?: (id: string) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return flows;
    const arr = [...flows];
    arr.sort((a, b) => {
      let cmp: number;
      if (sort.key === "crosses") {
        cmp = Number(a.crosses) - Number(b.crosses);
      } else {
        cmp = String(a[sort.key]).localeCompare(String(b[sort.key]), undefined, {
          sensitivity: "base",
        });
      }
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [flows, sort]);

  // Click a column: sort asc; click the active column again to flip to desc.
  const toggle = (key: SortKey) =>
    setSort((s) =>
      s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            {COLUMNS.map((c) => {
              const active = sort?.key === c.key;
              const Icon = !active ? ChevronsUpDown : sort!.dir === "asc" ? ChevronUp : ChevronDown;
              return (
                <th
                  key={c.key}
                  className="px-3 py-2 font-medium"
                  aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"}
                >
                  <button
                    type="button"
                    onClick={() => toggle(c.key)}
                    className={cn(
                      "-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground",
                      active && "text-foreground",
                    )}
                  >
                    {c.label}
                    <Icon className={cn("size-3.5", active ? "opacity-100" : "opacity-40")} />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={COLUMNS.length} className="px-3 py-3 text-muted-foreground">
                No flows recorded.
              </td>
            </tr>
          ) : (
            sorted.map((e) => {
              const active = activeId === e.id;
              const pinned = pinnedId === e.id;
              return (
                <tr
                  key={e.id}
                  tabIndex={0}
                  aria-current={pinned ? "true" : undefined}
                  onMouseEnter={() => onPreview?.(e.id)}
                  onMouseLeave={() => onPreview?.(null)}
                  onFocus={() => onPreview?.(e.id)}
                  onBlur={() => onPreview?.(null)}
                  onClick={() => onTogglePin?.(e.id)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      onTogglePin?.(e.id);
                    }
                  }}
                  className={cn(
                    "cursor-pointer border-b outline-none last:border-0 even:bg-muted/20",
                    "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    active &&
                      "bg-primary/10 even:bg-primary/10 dark:bg-primary/20 dark:even:bg-primary/20",
                    // Inset shadow marks the row without changing its size, so nothing shifts.
                    (active || pinned) && "shadow-[inset_3px_0_0_0_hsl(var(--primary))]",
                  )}
                >
                  <td className="px-3 py-2">{e.from}</td>
                  <td className="px-3 py-2">{e.to}</td>
                  <td className="px-3 py-2">{e.data || "-"}</td>
                  <td className="px-3 py-2">{e.dataClass || "-"}</td>
                  <td className="px-3 py-2">
                    {e.crosses ? (
                      <span className="font-medium text-red-700 dark:text-red-400">Yes</span>
                    ) : (
                      <span className="text-muted-foreground">No</span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
