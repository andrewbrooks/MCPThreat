import type { McpCategory } from "@/lib/taxonomy";

// Indicative mappings from MCP threat categories to industry frameworks:
// the OWASP Top 10 for LLM Applications (2025) and MITRE ATLAS techniques.
// These are guidance cross-references, not authoritative classifications.

export interface FrameworkItem {
  id: string;
  name: string;
  url: string;
}

const OWASP_BASE = "https://genai.owasp.org/llmrisk/";
const ATLAS_BASE = "https://atlas.mitre.org/techniques/";

// id → [name, page slug]
const OWASP_LLM: Record<string, [string, string]> = {
  LLM01: ["Prompt Injection", "llm01-prompt-injection"],
  LLM02: ["Sensitive Information Disclosure", "llm02-sensitive-information-disclosure"],
  LLM03: ["Supply Chain", "llm03-supply-chain"],
  LLM04: ["Data and Model Poisoning", "llm04-data-and-model-poisoning"],
  LLM05: ["Improper Output Handling", "llm05-improper-output-handling"],
  LLM06: ["Excessive Agency", "llm06-excessive-agency"],
  LLM07: ["System Prompt Leakage", "llm07-system-prompt-leakage"],
  LLM08: ["Vector and Embedding Weaknesses", "llm08-vector-and-embedding-weaknesses"],
  LLM09: ["Misinformation", "llm09-misinformation"],
  LLM10: ["Unbounded Consumption", "llm10-unbounded-consumption"],
};

const MITRE_ATLAS: Record<string, string> = {
  "AML.T0051": "LLM Prompt Injection",
  "AML.T0053": "LLM Plugin Compromise",
  "AML.T0054": "LLM Jailbreak",
  "AML.T0010": "ML Supply Chain Compromise",
  "AML.T0024": "Exfiltration via ML Inference API",
  "AML.T0025": "Exfiltration via Cyber Means",
  "AML.T0048": "External Harms",
};

const MAPPING: Record<McpCategory, { owasp: string[]; atlas: string[] }> = {
  TOOL_POISONING: { owasp: ["LLM01", "LLM04", "LLM05"], atlas: ["AML.T0051", "AML.T0053"] },
  CONFUSED_DEPUTY: { owasp: ["LLM06"], atlas: ["AML.T0053"] },
  TOKEN_PASSTHROUGH: { owasp: ["LLM02", "LLM06"], atlas: ["AML.T0025"] },
  SSRF: { owasp: ["LLM06", "LLM05"], atlas: ["AML.T0048"] },
  ROGUE_SERVER: { owasp: ["LLM03"], atlas: ["AML.T0010", "AML.T0053"] },
  PROMPT_INJECTION: { owasp: ["LLM01"], atlas: ["AML.T0051", "AML.T0054"] },
  SUPPLY_CHAIN: { owasp: ["LLM03", "LLM04"], atlas: ["AML.T0010"] },
  DATA_EXFILTRATION: { owasp: ["LLM02"], atlas: ["AML.T0024", "AML.T0025"] },
  MULTI_TENANCY: { owasp: ["LLM02"], atlas: ["AML.T0024"] },
  OTHER: { owasp: ["LLM10", "LLM06"], atlas: ["AML.T0048"] },
};

export const OWASP_LLM_URL = "https://genai.owasp.org/llm-top-10/";
export const MITRE_ATLAS_URL = "https://atlas.mitre.org/matrices/atlas";

function owaspItem(id: string): FrameworkItem {
  const entry = OWASP_LLM[id];
  return { id, name: entry?.[0] ?? id, url: entry ? `${OWASP_BASE}${entry[1]}/` : OWASP_LLM_URL };
}
function atlasItem(id: string): FrameworkItem {
  return { id, name: MITRE_ATLAS[id] ?? id, url: `${ATLAS_BASE}${id}` };
}

export function frameworksForCategory(category: McpCategory): {
  owasp: FrameworkItem[];
  atlas: FrameworkItem[];
} {
  const m = MAPPING[category] ?? { owasp: [], atlas: [] };
  return { owasp: m.owasp.map(owaspItem), atlas: m.atlas.map(atlasItem) };
}

/** Union of framework items across a set of MCP categories (for coverage reporting). */
export function frameworksForCategories(categories: string[]): {
  owasp: FrameworkItem[];
  atlas: FrameworkItem[];
} {
  const owasp = new Map<string, FrameworkItem>();
  const atlas = new Map<string, FrameworkItem>();
  for (const c of categories) {
    const refs = frameworksForCategory(c as McpCategory);
    refs.owasp.forEach((i) => owasp.set(i.id, i));
    refs.atlas.forEach((i) => atlas.set(i.id, i));
  }
  const byId = (a: FrameworkItem, b: FrameworkItem) => a.id.localeCompare(b.id);
  return {
    owasp: [...owasp.values()].sort(byId),
    atlas: [...atlas.values()].sort(byId),
  };
}
