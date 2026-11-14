import { describe, expect, it } from "vitest";
import type { Assessment } from "@/lib/assessment";
import {
  assessmentContentHash,
  canonicalJson,
  parseStoredAssessment,
  serialiseForSnapshot,
} from "@/lib/snapshot";

const base = (over: Record<string, unknown> = {}) =>
  ({ generatedAt: "2026-01-01T00:00:00.000Z", title: "t", n: [1, { b: 2, a: 1 }], ...over }) as unknown as Assessment;

describe("canonicalJson", () => {
  it("sorts keys at every level", () => {
    expect(canonicalJson({ b: 1, a: { d: 1, c: 2 } })).toBe('{"a":{"c":2,"d":1},"b":1}');
  });
  it("keeps array order", () => {
    expect(canonicalJson([3, 1, 2])).toBe("[3,1,2]");
  });
});

describe("assessmentContentHash", () => {
  it("ignores key order, generation time and the snapshot block", () => {
    const a = base();
    const b = base({ generatedAt: "2030-01-01T00:00:00.000Z", snapshot: { version: 3 } });
    expect(assessmentContentHash(a)).toBe(assessmentContentHash(b));
  });
  it("changes when content changes", () => {
    expect(assessmentContentHash(base())).not.toBe(assessmentContentHash(base({ title: "u" })));
  });
  it("is 64 hex characters", () => {
    expect(assessmentContentHash(base())).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("stored snapshot round trip", () => {
  it("parses back intact", () => {
    const a = base();
    const { intact, assessment } = parseStoredAssessment(serialiseForSnapshot(a), assessmentContentHash(a));
    expect(intact).toBe(true);
    expect((assessment as unknown as { title: string }).title).toBe("t");
  });
  it("detects tampering", () => {
    const a = base();
    const hash = assessmentContentHash(a);
    const tampered = serialiseForSnapshot(a).replace('"title":"t"', '"title":"changed"');
    expect(parseStoredAssessment(tampered, hash).intact).toBe(false);
  });
});
