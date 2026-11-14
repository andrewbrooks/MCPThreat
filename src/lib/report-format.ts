// Small formatting helpers shared by the on-screen report and the Markdown and HTML
// exports, so a timestamp or file size reads the same everywhere.

export const NOT_RECORDED = "Not recorded";

/** "2026-11-14T03:22:10.000Z" -> "2026-11-14 03:22 UTC". */
export function utc(iso: string | null): string {
  return iso ? `${iso.replace("T", " ").slice(0, 16)} UTC` : NOT_RECORDED;
}

/** "2026-11-14T..." -> "2026-11-14", or a dash when absent. */
export function day(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "—";
}

/** A byte count as "512 B", "3.4 KB" or "1.2 MB" for reports. */
export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
