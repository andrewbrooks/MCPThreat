import * as React from "react";

// Minimal markdown renderer for the subset the report generator emits: headings,
// tables, unordered lists, blockquotes, and inline bold / italic / code.

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Split on **bold**, `code`, and _italic_ while keeping delimiters.
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g;
  const parts = text.split(regex);
  parts.forEach((part, i) => {
    if (!part) return;
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      nodes.push(<strong key={key}>{part.slice(2, -2)}</strong>);
    } else if (part.startsWith("`") && part.endsWith("`")) {
      nodes.push(
        <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>,
      );
    } else if (part.startsWith("_") && part.endsWith("_")) {
      nodes.push(<em key={key}>{part.slice(1, -1)}</em>);
    } else {
      nodes.push(<React.Fragment key={key}>{part}</React.Fragment>);
    }
  });
  return nodes;
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

export function Markdown({ source }: { source: string }) {
  const lines = source.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Table
    if (line.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const header = splitRow(tableLines[0]);
      const bodyRows = tableLines.slice(2).map(splitRow); // skip the --- separator
      blocks.push(
        <div key={key++} className="my-4 overflow-x-auto rounded-lg border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {header.map((h, hi) => (
                  <th
                    key={hi}
                    className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {renderInline(h, `th-${key}-${hi}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri} className="border-b last:border-0 even:bg-muted/20">
                  {row.map((c, ci) => (
                    <td key={ci} className="px-3 py-2 align-top leading-snug">
                      {renderInline(c, `td-${key}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Headings
    if (line.startsWith("### ")) {
      blocks.push(
        <h3 key={key++} className="mt-4 text-base font-semibold">
          {renderInline(line.slice(4), `h3-${key}`)}
        </h3>,
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push(
        <h2 key={key++} className="mt-6 border-b pb-1 text-lg font-semibold">
          {renderInline(line.slice(3), `h2-${key}`)}
        </h2>,
      );
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push(
        <h1 key={key++} className="text-2xl font-bold">
          {renderInline(line.slice(2), `h1-${key}`)}
        </h1>,
      );
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      blocks.push(
        <blockquote
          key={key++}
          className="my-2 border-l-2 border-border pl-3 text-sm text-muted-foreground"
        >
          {renderInline(line.slice(2), `bq-${key}`)}
        </blockquote>,
      );
      i++;
      continue;
    }

    // Unordered list
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-2 list-inside list-disc space-y-1 text-sm">
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it, `li-${key}-${ii}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph
    blocks.push(
      <p key={key++} className="my-2 text-sm leading-relaxed">
        {renderInline(line, `p-${key}`)}
      </p>,
    );
    i++;
  }

  return <div className="print-full">{blocks}</div>;
}
