import { BellRing, CalendarClock, Pencil } from "lucide-react";
import { WrapEmail } from "@/components/shared/wrap-email";
import {
  AiBadge,
  ConfidenceBadge,
  McpCategoryBadge,
  SeverityBadge,
  StatusPill,
} from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { findingColor } from "@/lib/finding-colors";
import { STATUS_LABELS, type FindingStatus } from "@/lib/taxonomy";
import { toDateInput, type FindingRow } from "./types";

function FindingTableRow({
  f,
  editable,
  isSelected,
  toggle,
  inlineStatus,
  statusOptionsFor,
  openEdit,
}: {
  f: FindingRow;
  editable: boolean;
  isSelected: boolean;
  toggle: (id: string) => void;
  inlineStatus: (id: string, status: string) => void;
  statusOptionsFor: (current: string) => FindingStatus[];
  openEdit: (f: FindingRow) => void;
}) {
  return (
    <TableRow>
      <TableCell
        className="w-1 p-0"
        style={{ backgroundColor: findingColor(f.severity, f.status) }}
      />
      {editable ? (
        <TableCell>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggle(f.id)}
            aria-label={`Select ${f.title}`}
          />
        </TableCell>
      ) : null}
      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
        {f.displayId}
      </TableCell>
      <TableCell>
        <SeverityBadge severity={f.severity} />
      </TableCell>
      <TableCell className="min-w-[13rem] max-w-md">
        <div className="font-medium">{f.title}</div>
        {f.threatVector ? (
          <div className="text-xs text-muted-foreground">{f.threatVector.title}</div>
        ) : null}
        {f.source === "AI" ? (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <AiBadge />
            {f.confidence ? <ConfidenceBadge confidence={f.confidence} /> : null}
          </div>
        ) : null}
        {f.reviewDueAt ? (
          <div className="mt-0.5 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
            <CalendarClock className="size-3" /> Revisit {toDateInput(f.reviewDueAt)}
          </div>
        ) : null}
        {f.reminderIntervalDays ? (
          <div className="mt-0.5 flex items-center gap-1 text-xs text-sky-700 dark:text-sky-400">
            <BellRing className="size-3" /> Reminds owner every {f.reminderIntervalDays}d
          </div>
        ) : null}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {f.threatVector ? (
          <McpCategoryBadge
            category={f.threatVector.mcpCategory}
            className="min-w-[9rem] justify-center"
          />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        {editable && f.status !== "PENDING_ACCEPTANCE" ? (
          <Select
            aria-label={`Status of ${f.displayId}`}
            value={f.status}
            onChange={(e) => inlineStatus(f.id, e.target.value)}
            className="h-8 w-32"
          >
            {statusOptionsFor(f.status).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        ) : (
          <StatusPill status={f.status} />
        )}
      </TableCell>
      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
        {f.owner ? <WrapEmail value={f.owner} /> : "—"}
      </TableCell>
      <TableCell className="hidden whitespace-nowrap text-sm tabular-nums text-muted-foreground lg:table-cell">
        {f.dueDate ? toDateInput(f.dueDate) : "—"}
      </TableCell>
      {editable ? (
        <TableCell>
          <Button variant="ghost" size="icon" onClick={() => openEdit(f)} aria-label="Edit">
            <Pencil className="size-4" />
          </Button>
        </TableCell>
      ) : null}
    </TableRow>
  );
}

/** The findings table: one row per finding, with selection and inline status when editable. */
export function FindingsGrid({
  filtered,
  editable,
  selected,
  allSelected,
  setSelected,
  toggle,
  inlineStatus,
  statusOptionsFor,
  openEdit,
}: {
  filtered: FindingRow[];
  editable: boolean;
  selected: Set<string>;
  allSelected: boolean;
  setSelected: (ids: Set<string>) => void;
  toggle: (id: string) => void;
  inlineStatus: (id: string, status: string) => void;
  statusOptionsFor: (current: string) => FindingStatus[];
  openEdit: (f: FindingRow) => void;
}) {
  return (
    <Table className="[&_td]:px-2 [&_th]:px-2">
      <TableHeader>
        <TableRow>
          <TableHead className="w-1 p-0">
            <span className="sr-only">Severity marker</span>
          </TableHead>
          {editable ? (
            <TableHead className="w-8">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) =>
                  setSelected(e.target.checked ? new Set(filtered.map((f) => f.id)) : new Set())
                }
                aria-label="Select all"
              />
            </TableHead>
          ) : null}
          <TableHead>ID</TableHead>
          <TableHead>Severity</TableHead>
          <TableHead>Finding</TableHead>
          <TableHead className="hidden md:table-cell">Category</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden lg:table-cell">Owner</TableHead>
          <TableHead className="hidden lg:table-cell">Due</TableHead>
          {editable ? (
            <TableHead className="w-10">
              <span className="sr-only">Actions</span>
            </TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {filtered.map((f) => (
          <FindingTableRow
            key={f.id}
            f={f}
            editable={editable}
            isSelected={selected.has(f.id)}
            toggle={toggle}
            inlineStatus={inlineStatus}
            statusOptionsFor={statusOptionsFor}
            openEdit={openEdit}
          />
        ))}
      </TableBody>
    </Table>
  );
}
