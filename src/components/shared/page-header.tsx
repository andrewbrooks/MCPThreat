import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The title block used at the top of every page, so they all look and align the same:
 * an optional back link, the title, a one-line description, and actions on the right.
 */
export function PageHeader({
  title,
  description,
  back,
  actions,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  /** Extra content under the description, still inside the header rule. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("space-y-2 border-b pb-5", className)}>
      {back ? (
        <Link
          href={back.href}
          className="inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}
