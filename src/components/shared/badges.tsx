import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CONFIDENCE_BADGE_CLASSES,
  CONFIDENCE_LABELS,
  MCP_CATEGORY_LABELS,
  PROJECT_STATUS_CLASSES,
  PROJECT_STATUS_LABELS,
  RISK_LEVEL_CLASSES,
  RISK_LEVEL_LABELS,
  SEVERITY_BADGE_CLASSES,
  SEVERITY_LABELS,
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
  STRIDE_LABELS,
  type Confidence,
  type McpCategory,
  type ProjectStatus,
  type RiskLevel,
  type Severity,
  type FindingStatus,
  type StrideCategory,
} from "@/lib/taxonomy";

export function SeverityBadge({ severity, className }: { severity: string; className?: string }) {
  const s = severity as Severity;
  return (
    <Badge className={cn(SEVERITY_BADGE_CLASSES[s] ?? SEVERITY_BADGE_CLASSES.INFO, className)}>
      {SEVERITY_LABELS[s] ?? severity}
    </Badge>
  );
}

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const s = status as FindingStatus;
  return (
    <Badge className={cn(STATUS_BADGE_CLASSES[s] ?? STATUS_BADGE_CLASSES.OPEN, className)}>
      {STATUS_LABELS[s] ?? status}
    </Badge>
  );
}

export function RiskBadge({
  level,
  prefix,
  className,
}: {
  level: string;
  prefix?: string;
  className?: string;
}) {
  const l = level as RiskLevel;
  return (
    <Badge className={cn(RISK_LEVEL_CLASSES[l] ?? RISK_LEVEL_CLASSES.MEDIUM, className)}>
      {prefix ? `${prefix}: ` : ""}
      {RISK_LEVEL_LABELS[l] ?? level}
    </Badge>
  );
}

export function ProjectStatusBadge({ status, className }: { status: string; className?: string }) {
  const s = status as ProjectStatus;
  return (
    <Badge className={cn(PROJECT_STATUS_CLASSES[s] ?? PROJECT_STATUS_CLASSES.ACTIVE, className)}>
      {PROJECT_STATUS_LABELS[s] ?? status}
    </Badge>
  );
}

export function StrideBadge({ category, className }: { category: string; className?: string }) {
  const c = category as StrideCategory;
  return (
    <Badge
      className={cn(
        "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300",
        className,
      )}
    >
      {STRIDE_LABELS[c] ?? category}
    </Badge>
  );
}

/** Marks an item that was suggested by the GitHub auto-analysis, not hand-authored. */
export function AiBadge({ className }: { className?: string }) {
  return (
    <Badge
      className={cn(
        "gap-1 border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300",
        className,
      )}
      title="Suggested by automated analysis — review before relying on it"
    >
      <Sparkles className="size-3" /> AI-suggested
    </Badge>
  );
}

export function ConfidenceBadge({
  confidence,
  className,
}: {
  confidence: string;
  className?: string;
}) {
  const c = confidence as Confidence;
  const classes = CONFIDENCE_BADGE_CLASSES[c];
  if (!classes) return null;
  return <Badge className={cn(classes, className)}>{CONFIDENCE_LABELS[c] ?? confidence}</Badge>;
}

export function McpCategoryBadge({
  category,
  className,
}: {
  category: string;
  className?: string;
}) {
  const c = category as McpCategory;
  return (
    <Badge
      className={cn(
        "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-500/15 dark:text-cyan-300",
        className,
      )}
    >
      {MCP_CATEGORY_LABELS[c] ?? category}
    </Badge>
  );
}
