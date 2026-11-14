import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  FINDING_STATUSES,
  SEVERITIES,
  SEVERITY_LABELS,
  STATUS_LABELS,
  type FindingStatus,
} from "@/lib/taxonomy";
import type { SortKey } from "./types";

/** The filter, sort and "New Finding" controls above the table. */
export function FindingsFilters({
  severityFilter,
  setSeverityFilter,
  statusFilter,
  setStatusFilter,
  ownerFilter,
  setOwnerFilter,
  sortKey,
  setSortKey,
  editable,
  openCreate,
  noVectors,
}: {
  severityFilter: string;
  setSeverityFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  ownerFilter: string;
  setOwnerFilter: (v: string) => void;
  sortKey: SortKey;
  setSortKey: (v: SortKey) => void;
  editable: boolean;
  openCreate: () => void;
  /** There is no threat vector to attach a finding to, so creating is disabled. */
  noVectors: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="filter-severity" className="text-xs">
          Severity
        </Label>
        <Select
          id="filter-severity"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="w-40"
        >
          <option value="">All severities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {SEVERITY_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="filter-status" className="text-xs">
          Status
        </Label>
        <Select
          id="filter-status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-40"
        >
          <option value="">All statuses</option>
          {FINDING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>
      {editable ? (
        <div className="space-y-1">
          <Label htmlFor="filter-owner" className="text-xs">
            Owner
          </Label>
          <Input
            id="filter-owner"
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            placeholder="Filter owner…"
            className="w-44"
          />
        </div>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor="filter-sort" className="text-xs">
          Sort by
        </Label>
        <Select
          id="filter-sort"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="w-40"
        >
          <option value="severity">Severity</option>
          <option value="status">Status</option>
          <option value="owner">Owner</option>
          <option value="dueDate">Due date</option>
        </Select>
      </div>
      {editable ? (
        <div className="ml-auto">
          <Button size="sm" onClick={openCreate} disabled={noVectors}>
            <Plus className="size-4" /> New Finding
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** The bar shown while rows are selected, for changing their status together. */
export function BulkBar({
  selectedCount,
  bulkStatus,
  setBulkStatus,
  statusOptions,
  applyBulk,
  clearSelection,
}: {
  selectedCount: number;
  bulkStatus: string;
  setBulkStatus: (v: string) => void;
  statusOptions: FindingStatus[];
  applyBulk: () => void;
  clearSelection: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-2 text-sm">
      <span className="text-muted-foreground">{selectedCount} selected</span>
      <Select
        aria-label="Set status for selected findings"
        value={bulkStatus}
        onChange={(e) => setBulkStatus(e.target.value)}
        className="h-8 w-40"
      >
        {statusOptions.map((s) => (
          <option key={s} value={s}>
            Set to {STATUS_LABELS[s]}
          </option>
        ))}
      </Select>
      <Button size="sm" onClick={applyBulk}>
        Apply
      </Button>
      <Button size="sm" variant="ghost" onClick={clearSelection}>
        Clear
      </Button>
    </div>
  );
}
