import Link from "next/link";
import type { WorklistItem } from "@/lib/workflow-types";

const GROUPS: { priority: 1 | 2 | 3; label: string }[] = [
  { priority: 1, label: "Act now" },
  { priority: 2, label: "Soon" },
  { priority: 3, label: "For awareness" },
];
const VISIBLE = 8;

function Item({ item }: { item: WorklistItem }) {
  return (
    <li className="py-2 first:pt-0 last:pb-0">
      <p className="text-xs text-muted-foreground break-words">{item.projectName}</p>
      <Link href={item.href} className="break-words text-sm font-medium underline underline-offset-2">
        {item.title}
      </Link>
      <p className="break-words text-sm text-muted-foreground">{item.detail}</p>
    </li>
  );
}

function Groups({ items }: { items: WorklistItem[] }) {
  return (
    <>
      {GROUPS.map((g) => {
        const rows = items.filter((i) => i.priority === g.priority);
        if (rows.length === 0) return null;
        return (
          <div key={g.priority} className="space-y-1">
            <h3 className="text-sm font-semibold">{g.label}</h3>
            <ul className="divide-y">
              {rows.map((i) => (
                <Item key={i.id} item={i} />
              ))}
            </ul>
          </div>
        );
      })}
    </>
  );
}

export function WorklistSection({ items }: { items: WorklistItem[] }) {
  if (items.length === 0) return null;
  const sorted = [...items].sort((a, b) => a.priority - b.priority);
  const head = sorted.slice(0, VISIBLE);
  const rest = sorted.slice(VISIBLE);
  return (
    <section
      aria-labelledby="needs-attention-heading"
      className="space-y-4 rounded-lg border bg-card p-4"
    >
      <h2 id="needs-attention-heading" className="text-lg font-semibold">
        Needs attention
      </h2>
      <Groups items={head} />
      {rest.length > 0 ? (
        <details className="space-y-4">
          <summary className="cursor-pointer text-sm font-medium underline underline-offset-2">
            Show {rest.length} more
          </summary>
          <div className="mt-4 space-y-4">
            <Groups items={rest} />
          </div>
        </details>
      ) : null}
    </section>
  );
}
