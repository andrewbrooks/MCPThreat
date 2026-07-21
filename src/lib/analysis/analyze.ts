// Claude-powered analysis of a distilled GitHub repo bundle. We force a single
// tool call whose input schema mirrors the app taxonomy, so Claude returns a
// structured, already-categorized threat model. The prompt instructs strictly
// conservative behavior: only well-evidenced items, every item cites file paths,
// no speculation, and everything maps onto the fixed taxonomy.
//
// Forced tool_choice ({type:"tool"}) is used for deterministic structured output;
// it is intentionally not combined with extended thinking (incompatible on the API).

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { RepoBundle } from "@/lib/github";
import { DATAFLOW_NODE_TYPES } from "@/lib/dataflow";
import {
  CONFIDENCE_LEVELS,
  MCP_CATEGORIES,
  RISK_LEVELS,
  SEVERITIES,
  STRIDE_CATEGORIES,
  TRUST_BOUNDARY_TYPES,
} from "@/lib/taxonomy";

const DEFAULT_MODEL = "claude-opus-4-8";
const TOOL_NAME = "record_threat_model";

export class AnalysisError extends Error {}

// --- Validation schema (also documents the tool's expected output) ----------

const zNode = z.object({
  id: z.string().min(1).max(120),
  label: z.string().min(1).max(200),
  type: z.enum(DATAFLOW_NODE_TYPES),
  tier: z.coerce.number().int().min(0).max(12).default(0),
  trustZone: z.string().max(120).optional().default(""),
});

const zEdge = z.object({
  from: z.string().min(1).max(120),
  to: z.string().min(1).max(120),
  label: z.string().max(200).optional().default(""),
  dataClass: z.string().max(120).optional().default(""),
  crossesBoundary: z.boolean().optional().default(false),
});

const zBoundary = z.object({
  label: z.string().min(1).max(160),
  description: z.string().max(4000).optional().default(""),
  type: z.enum(TRUST_BOUNDARY_TYPES),
  confidence: z.enum(CONFIDENCE_LEVELS),
  evidence: z.string().max(4000).optional().default(""),
});

const zVector = z.object({
  boundaryLabel: z.string().min(1).max(160),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional().default(""),
  strideCategory: z.enum(STRIDE_CATEGORIES),
  mcpCategory: z.enum(MCP_CATEGORIES),
  likelihood: z.enum(RISK_LEVELS).optional().default("MEDIUM"),
  impact: z.enum(RISK_LEVELS).optional().default("MEDIUM"),
  confidence: z.enum(CONFIDENCE_LEVELS),
  evidence: z.string().max(4000).optional().default(""),
});

const zFinding = z.object({
  vectorTitle: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  description: z.string().max(8000).optional().default(""),
  recommendation: z.string().max(8000).optional().default(""),
  severity: z.enum(SEVERITIES),
  confidence: z.enum(CONFIDENCE_LEVELS),
  evidence: z.string().max(8000).optional().default(""),
});

export const analysisResultSchema = z.object({
  architectureMarkdown: z.string().max(20000).optional().default(""),
  techStack: z.array(z.string().max(60)).max(40).optional().default([]),
  dataflow: z
    .object({
      nodes: z.array(zNode).max(60).optional().default([]),
      edges: z.array(zEdge).max(120).optional().default([]),
    })
    .optional()
    .default({ nodes: [], edges: [] }),
  boundaries: z.array(zBoundary).max(30).optional().default([]),
  vectors: z.array(zVector).max(60).optional().default([]),
  findings: z.array(zFinding).max(60).optional().default([]),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

// --- Tool JSON schema (kept in lockstep with the taxonomy) ------------------

const enumProp = (values: readonly string[], description: string) => ({
  type: "string" as const,
  enum: [...values],
  description,
});

const toolInputSchema = {
  type: "object",
  properties: {
    architectureMarkdown: {
      type: "string",
      description:
        "Concise Markdown describing the application's architecture: what it is, the MCP surface (server, transport, tools/resources), key components, and external dependencies. Cite file paths inline. Empty string if the repo is not analyzable.",
    },
    techStack: {
      type: "array",
      items: { type: "string" },
      description: "Short technology tags detected (e.g. 'TypeScript', 'FastMCP', 'Docker').",
    },
    dataflow: {
      type: "object",
      description: "A data-flow diagram of the application.",
      properties: {
        nodes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Stable short id, e.g. 'user', 'mcp_server'." },
              label: { type: "string" },
              type: enumProp(DATAFLOW_NODE_TYPES, "DFD element kind."),
              tier: {
                type: "integer",
                description:
                  "Layer index for left→right layout: 0 external entities, 1 the MCP process, 2 downstream tools/datastores, etc.",
              },
              trustZone: { type: "string", description: "Optional trust-zone name." },
            },
            required: ["id", "label", "type", "tier"],
          },
        },
        edges: {
          type: "array",
          items: {
            type: "object",
            properties: {
              from: { type: "string", description: "Source node id." },
              to: { type: "string", description: "Target node id." },
              label: { type: "string", description: "What flows (e.g. 'tool call', 'API response')." },
              dataClass: { type: "string", description: "Data classification, e.g. 'credentials', 'PII', 'public'." },
              crossesBoundary: {
                type: "boolean",
                description: "True if this flow crosses a trust boundary.",
              },
            },
            required: ["from", "to", "label", "crossesBoundary"],
          },
        },
      },
      required: ["nodes", "edges"],
    },
    boundaries: {
      type: "array",
      description: "Trust boundaries. Only include boundaries clearly evidenced by the code/docs.",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          description: { type: "string" },
          type: enumProp(TRUST_BOUNDARY_TYPES, "Trust boundary type."),
          confidence: enumProp(CONFIDENCE_LEVELS, "How well-evidenced this boundary is."),
          evidence: { type: "string", description: "Cited file path(s) and a short rationale." },
        },
        required: ["label", "type", "confidence"],
      },
    },
    vectors: {
      type: "array",
      description:
        "Threat vectors, each attached to a boundary by its exact label. Be conservative — only threats supported by evidence in this repo.",
      items: {
        type: "object",
        properties: {
          boundaryLabel: { type: "string", description: "Exact label of the boundary this vector belongs to." },
          title: { type: "string" },
          description: { type: "string" },
          strideCategory: enumProp(STRIDE_CATEGORIES, "STRIDE category."),
          mcpCategory: enumProp(MCP_CATEGORIES, "MCP-specific threat category."),
          likelihood: enumProp(RISK_LEVELS, "Likelihood."),
          impact: enumProp(RISK_LEVELS, "Impact."),
          confidence: enumProp(CONFIDENCE_LEVELS, "How well-evidenced this vector is."),
          evidence: { type: "string", description: "Cited file path(s) and a short rationale." },
        },
        required: ["boundaryLabel", "title", "strideCategory", "mcpCategory", "confidence"],
      },
    },
    findings: {
      type: "array",
      description:
        "Concrete findings, each attached to a vector by its exact title. Only include HIGH-confidence, concretely-evidenced issues — omit anything speculative.",
      items: {
        type: "object",
        properties: {
          vectorTitle: { type: "string", description: "Exact title of the vector this finding relates to." },
          title: { type: "string" },
          description: { type: "string" },
          recommendation: { type: "string" },
          severity: enumProp(SEVERITIES, "Severity."),
          confidence: enumProp(CONFIDENCE_LEVELS, "Confidence in this finding."),
          evidence: { type: "string", description: "Cited file path(s) and a short rationale." },
        },
        required: ["vectorTitle", "title", "severity", "confidence"],
      },
    },
  },
  required: ["architectureMarkdown", "techStack", "dataflow", "boundaries", "vectors", "findings"],
} as const;

const SYSTEM_PROMPT = `You are a security engineer performing threat modeling on a Model Context Protocol (MCP) server codebase. You will receive a distilled set of files from a public GitHub repository.

Your job: produce a structured threat model by calling the ${TOOL_NAME} tool exactly once. Be rigorous and CONSERVATIVE:
- Ground every item in evidence you can actually see in the provided files. Cite file paths in the evidence field.
- Do NOT invent threats. If the repo shows no evidence for a threat, do not include it. A non-MCP or trivial repo should yield few or zero vectors/findings, an architecture summary, and a best-effort dataflow.
- Assign confidence honestly: HIGH only when the code/docs directly demonstrate the issue; MEDIUM when strongly implied; LOW when plausible but weakly evidenced.
- Map everything onto the fixed taxonomy enums provided by the tool schema. Never invent enum values.
- Vectors reference their boundary by that boundary's exact label; findings reference their vector by that vector's exact title.
- The dataflow should capture the real flows: user/LLM → MCP server → tools/downstream APIs/datastores, marking flows that cross a trust boundary.
- Write the architecture summary as clear Markdown for a security reader.`;

function buildUserPrompt(bundle: RepoBundle): string {
  const header = [
    `Repository: ${bundle.owner}/${bundle.repo} (default branch: ${bundle.ref})`,
    bundle.description ? `Description: ${bundle.description}` : null,
    bundle.mcpSignals.length
      ? `Detected MCP signals:\n- ${bundle.mcpSignals.join("\n- ")}`
      : "Detected MCP signals: none found by prefilter.",
  ]
    .filter(Boolean)
    .join("\n");

  const fileBlocks = bundle.files
    .map(
      (f) =>
        `----- FILE: ${f.path}${f.truncated ? " (truncated)" : ""} -----\n${f.content}`,
    )
    .join("\n\n");

  return `${header}\n\nBelow are the most relevant files from the repository.\n\n${fileBlocks}\n\nAnalyze this repository and call ${TOOL_NAME} once with the structured threat model.`;
}

export function isAnalysisConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Run the Claude analysis. Throws AnalysisError with a readable message on failure. */
export async function analyzeRepo(bundle: RepoBundle): Promise<AnalysisResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AnalysisError("Analysis is not configured (ANTHROPIC_API_KEY is unset).");
  }
  const client = new Anthropic();
  const model = process.env.ANALYSIS_MODEL?.trim() || DEFAULT_MODEL;

  let response;
  try {
    response = await client.messages.create({
      model,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: TOOL_NAME,
          description: "Record the structured threat model for the analyzed repository.",
          input_schema: toolInputSchema as unknown as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [{ role: "user", content: buildUserPrompt(bundle) }],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    throw new AnalysisError(`Claude analysis request failed: ${msg}`);
  }

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === TOOL_NAME,
  );
  if (!toolUse) {
    throw new AnalysisError("Claude did not return a structured threat model.");
  }

  const parsed = analysisResultSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new AnalysisError(
      `Analysis output failed validation: ${parsed.error.issues[0]?.message ?? "invalid shape"}`,
    );
  }
  return parsed.data;
}
