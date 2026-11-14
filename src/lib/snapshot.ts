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
  return createHash("sha256").update(canonicalJson(stripVolatile(a))).digest("hex");
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
