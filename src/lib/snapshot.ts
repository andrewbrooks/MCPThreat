import { createHash } from "node:crypto";
import type { Assessment } from "@/lib/assessment";

// Hashing and (de)serialisation for frozen assessment snapshots. Server-only
// (node:crypto). The hash identifies the assessed content, so it excludes fields that
// change on every render (the generation time and the snapshot block itself).

const EXCLUDED_KEYS = new Set(["generatedAt", "snapshot"]);

/** JSON with object keys sorted at every level, so equal content gives equal text. */
export function canonicalJson(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as object).sort()) {
        out[k] = sort((v as Record<string, unknown>)[k]);
      }
      return out;
    }
    return v;
  };
  return JSON.stringify(sort(value));
}

function stripVolatile(a: Assessment): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(a)) if (!EXCLUDED_KEYS.has(k)) out[k] = v;
  return out;
}

/** sha256 (hex) of the assessed content. */
export function assessmentContentHash(a: Assessment): string {
  return createHash("sha256")
    .update(canonicalJson(stripVolatile(a)))
    .digest("hex");
}

// Change detection compares the live model with the latest snapshot. It must ignore
// bookkeeping that moves without the assessed content changing: the audit trail (issuing
// a snapshot itself adds events), the last-updated time, and static explanatory text that
// ships with the tool. The full contentHash above still covers everything, for tamper
// evidence.
const MODEL_EXCLUDED_KEYS = new Set([
  ...EXCLUDED_KEYS,
  "audit",
  "tool",
  "schemaVersion",
  "scope",
  "definitions",
  "controls",
]);
const MODEL_EXCLUDED_RECORD_KEYS = new Set(["audit", "lastUpdatedAt"]);

/** sha256 (hex) of the assessed model only. Used to tell whether it changed since a snapshot. */
export function assessmentModelHash(a: Assessment): string {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(a)) {
    if (MODEL_EXCLUDED_KEYS.has(k)) continue;
    if (k === "record" && v && typeof v === "object") {
      const rec: Record<string, unknown> = {};
      for (const [rk, rv] of Object.entries(v as object)) {
        if (!MODEL_EXCLUDED_RECORD_KEYS.has(rk)) rec[rk] = rv;
      }
      out[k] = rec;
    } else {
      out[k] = v;
    }
  }
  return createHash("sha256").update(canonicalJson(out)).digest("hex");
}

/** The text stored with a snapshot: the assessment as issued, without a snapshot block. */
export function serialiseForSnapshot(a: Assessment): string {
  return JSON.stringify(stripVolatile(a));
}

/** Read a stored snapshot back into an Assessment and check it still matches its hash. */
export function parseStoredAssessment(
  stored: string,
  expectedHash: string,
): { assessment: Assessment; intact: boolean } {
  const assessment = JSON.parse(stored) as Assessment;
  return { assessment, intact: assessmentContentHash(assessment) === expectedHash };
}
