import { describe, expect, it } from "vitest";
import {
  buildAssessment,
  withSnapshot,
  type AssessmentInput,
  type SnapshotInfo,
} from "@/lib/assessment";
import { generateCsv } from "@/lib/report-csv";
import { generateHtml } from "@/lib/report-html";
import { generateReport } from "@/lib/report-markdown";
import { assessmentContentHash } from "@/lib/snapshot";

const T0 = new Date("2026-01-01T10:00:00Z");
const HASH = "a".repeat(64);

function input(): AssessmentInput {
  return {
    project: {
      id: "p1",
      name: "Demo",
      description: "",
      mcpServerUrl: null,
      architecture: "",
      status: "ACTIVE",
      acceptancePolicy: "DUAL",
      sourceType: "MANUAL",
      repoUrl: null,
      repoRef: null,
      analyzedAt: null,
      techStack: "",
      createdAt: T0,
      updatedAt: T0,
    },
    owner: { name: "Ann", email: "ann@example.com" },
    members: [],
    boundaries: [],
    findings: [],
    audit: [],
  } as unknown as AssessmentInput;
}

const info = (over: Partial<SnapshotInfo> = {}): SnapshotInfo => ({
  version: 3,
  issuedAt: "2026-02-01T09:30:00.000Z",
  issuedBy: "ann@example.com",
  note: "Pre-release review",
  contentHash: HASH,
  requirement: "DUAL",
  status: "RETURNED",
  signoffs: [
    {
      userId: "u-cli",
      side: "CLIENT",
      decision: "RETURNED",
      comment: '<script>alert("x")</script>',
      by: "cli@example.com",
      at: "2026-02-02T09:30:00.000Z",
    },
  ],
  integrity: "VERIFIED",
  ...over,
});

const live = buildAssessment(input(), T0);
const snap = withSnapshot(live, info());

describe("live reports", () => {
  it("carry a draft notice and no snapshot record", () => {
    for (const out of [generateReport(live), generateHtml(live)]) {
      expect(out).toContain("live draft");
      expect(out).toContain("Review and sign-off");
      expect(out).not.toContain("Content hash");
    }
  });
});

describe("snapshot reports", () => {
  it("show the snapshot record in markdown", () => {
    const md = generateReport(snap);
    expect(md).toContain("### Review and sign-off");
    expect(md).toContain(HASH);
    expect(md).toContain("Pre-release review");
    expect(md).toContain("Returned for changes");
    expect(md).toContain("2026-02-01 09:30 UTC");
    expect(md).not.toContain("Live draft");
    expect(md).toContain("not a digital signature");
  });
  it("show the snapshot record in html and escape comments", () => {
    const html = generateHtml(snap);
    expect(html).toContain("Review and sign-off");
    expect(html).toContain(HASH);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;alert");
    expect(html).not.toContain("live draft");
  });
  it("flag a failed integrity check prominently", () => {
    const failed = withSnapshot(live, info({ integrity: "FAILED" }));
    expect(generateReport(failed)).toContain("Integrity check failed");
    expect(generateHtml(failed)).toContain('role="alert"');
  });
});

describe("hash and csv", () => {
  it("hash is unaffected by the snapshot block", () => {
    expect(assessmentContentHash(snap)).toBe(assessmentContentHash(live));
  });
  it("csv is unaffected", () => {
    expect(generateCsv(snap)).toBe(generateCsv(live));
  });
});
