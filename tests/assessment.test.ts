import { describe, expect, it } from "vitest";
import { buildAssessment, type AssessmentInput } from "@/lib/assessment";
import { csvField, generateCsv } from "@/lib/report-csv";
import { escapeHtml, generateHtml, markdownToHtml } from "@/lib/report-html";
import { demoteHeadings, generateReport } from "@/lib/report-markdown";

const T0 = new Date("2026-01-01T10:00:00Z");
const T1 = new Date("2026-01-02T10:00:00Z");
const T2 = new Date("2026-01-03T10:00:00Z");

function input(over: Partial<AssessmentInput> = {}): AssessmentInput {
  return {
    project: {
      id: "p1",
      name: "Demo <b>MCP</b>",
      description: "",
      mcpServerUrl: null,
      architecture: "# Arch\n\n## Parts\n\n- one",
      status: "ACTIVE",
      acceptancePolicy: "OFF",
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
    boundaries: [
      {
        id: "b-late",
        label: "Second",
        type: "AGENT_TO_SERVER",
        description: "",
        source: "MANUAL",
        createdAt: T1,
        vectors: [],
      },
      {
        id: "b-early",
        label: "First",
        type: "AGENT_TO_SERVER",
        description: "",
        source: "AI",
        createdAt: T0,
        vectors: [
          {
            id: "v1",
            title: "Poisoned tool",
            description: "",
            strideCategory: "TAMPERING",
            mcpCategory: "TOOL_POISONING",
            likelihood: "HIGH",
            impact: "HIGH",
            source: "AI",
            confidence: "MEDIUM",
            createdAt: T0,
          },
        ],
      },
    ],
    findings: [
      {
        id: "f-b",
        threatVectorId: "v1",
        title: "=HYPERLINK(\"http://x\")",
        description: "Desc | with pipe",
        recommendation: "Fix it",
        evidence: "",
        severity: "LOW",
        status: "MITIGATED",
        source: "MANUAL",
        confidence: null,
        owner: "",
        dueDate: null,
        createdAt: T2,
        updatedAt: T2,
      },
      {
        id: "f-a",
        threatVectorId: "v1",
        title: "Unpinned schema",
        description: "Why it matters",
        recommendation: "Pin it",
        evidence: "ref <script>",
        severity: "CRITICAL",
        status: "OPEN",
        source: "AI",
        confidence: "HIGH",
        owner: "sec@example.com",
        dueDate: new Date("2026-02-01T00:00:00Z"),
        createdAt: T1,
        updatedAt: T1,
      },
    ],
    ...over,
  };
}

describe("buildAssessment identifiers", () => {
  const a = buildAssessment(input(), new Date("2026-03-01T00:00:00Z"));

  it("numbers items by creation order, not input order", () => {
    expect(a.boundaries.map((b) => [b.id, b.label])).toEqual([
      ["B-01", "First"],
      ["B-02", "Second"],
    ]);
    expect(a.findings.map((f) => [f.id, f.uid])).toEqual([
      ["F-001", "f-a"],
      ["F-002", "f-b"],
    ]);
    expect(a.vectors[0].id).toBe("T-01");
  });

  it("links findings and vectors by display id", () => {
    expect(a.findings[0].vectorId).toBe("T-01");
    expect(a.vectors[0].findingIds).toEqual(["F-001", "F-002"]);
  });

  it("records tool, schema and timestamp", () => {
    expect(a.tool.name).toBe("MCPThreat");
    expect(a.tool.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(a.schemaVersion).toBe("1.0");
    expect(a.generatedAt).toBe("2026-03-01T00:00:00.000Z");
  });

  it("computes counts, open definition and residual band", () => {
    expect(a.summary.findingCount).toBe(2);
    expect(a.summary.openCount).toBe(1);
    expect(a.summary.completionPct).toBe(100);
    expect(a.vectors[0].riskBand).toBe("CRITICAL");
    expect(a.vectors[0].residualBand).toBe("HIGH");
    expect(a.record.aiSuggested).toEqual({ boundaries: 1, vectors: 1, findings: 1 });
  });

  it("maps categories to frameworks as indicative ids", () => {
    expect(a.vectors[0].frameworks.owasp).toContain("LLM01");
    expect(a.frameworks.note).toMatch(/not a certification/i);
  });

  it("states scope limitations", () => {
    expect(a.scope.limitations.join(" ")).toMatch(/not a penetration test/i);
  });
});

describe("markdown report", () => {
  const md = generateReport(buildAssessment(input()));

  it("includes ids, rationale, recommendation and limitations", () => {
    expect(md).toContain("### F-001: Unpinned schema");
    expect(md).toContain("Why it matters");
    expect(md).toContain("Pin it");
    expect(md).toContain("## 2. Scope and limitations");
  });

  it("nests architecture headings below the section heading", () => {
    expect(md).toContain("### Arch");
    expect(md).toContain("#### Parts");
    expect(md).not.toMatch(/^# Arch/m);
  });

  it("escapes angle brackets and keeps table rows intact", () => {
    expect(md).toContain("ref \\<script>");
    const row = md.split("\n").find((l) => l.startsWith("| F-002"))!;
    expect(row.match(/(?<!\\)\|/g)).toHaveLength(8);
  });

  it("hides the pending-acceptance row when no policy is set", () => {
    expect(md).not.toContain("Pending Acceptance |");
  });
});

describe("demoteHeadings", () => {
  it("leaves fenced code alone and caps at h6", () => {
    const out = demoteHeadings("# a\n```\n# not a heading\n```\n##### e", 3);
    expect(out).toBe("#### a\n```\n# not a heading\n```\n###### e");
  });
});

describe("html report", () => {
  const html = generateHtml(buildAssessment(input()));

  it("escapes user-controlled values", () => {
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>MCP</b>");
    expect(html).toContain("Demo &lt;b&gt;MCP&lt;/b&gt;");
  });

  it("is self-contained", () => {
    expect(html).not.toMatch(/<script|<link |src=/i);
  });

  it("shows severity as text", () => {
    expect(html).toMatch(/class="tag sev-critical">Critical</);
  });
});

describe("markdownToHtml / escapeHtml", () => {
  it("escapes html inside markdown", () => {
    expect(markdownToHtml("hello <img src=x onerror=1>")).not.toContain("<img");
  });
  it("escapes quotes", () => {
    expect(escapeHtml(`"'&<>`)).toBe("&quot;&#39;&amp;&lt;&gt;");
  });
});

describe("csv export", () => {
  it("neutralises spreadsheet formulas", () => {
    expect(csvField("=1+1")).toBe("'=1+1");
    expect(csvField("+cmd")).toBe("'+cmd");
    expect(csvField("@x")).toBe("'@x");
  });
  it("quotes commas, quotes and newlines", () => {
    expect(csvField('a,"b"\nc')).toBe('"a,""b""\nc"');
  });
  it("writes one row per finding after the header, most severe first", () => {
    const rows = generateCsv(buildAssessment(input())).trim().split("\r\n");
    expect(rows).toHaveLength(3);
    expect(rows[1].startsWith("F-001,Critical")).toBe(true);
    expect(rows[2]).toContain("'=HYPERLINK");
  });
});
