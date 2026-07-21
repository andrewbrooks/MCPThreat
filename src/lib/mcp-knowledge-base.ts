import type { McpCategory, StrideCategory } from "@/lib/taxonomy";

// Curated MCP security knowledge base. Each MCP threat category maps to a plain-language
// threat summary, concrete mitigations, typical STRIDE alignment, and clickable source
// references so users can cross-reference the guidance surfaced in the app.

export interface KnowledgeReference {
  label: string;
  url: string;
}

export interface KnowledgeEntry {
  category: McpCategory;
  title: string;
  summary: string;
  /** STRIDE categories this MCP threat most commonly maps to. */
  strideAlignment: StrideCategory[];
  mitigations: string[];
  references: KnowledgeReference[];
}

const SPEC_SECURITY: KnowledgeReference = {
  label: "MCP Security Best Practices",
  url: "https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices",
};
const SPEC_AUTHZ: KnowledgeReference = {
  label: "MCP Authorization Specification",
  url: "https://modelcontextprotocol.io/specification/latest/basic/authorization",
};
const OWASP_MCP: KnowledgeReference = {
  label: "OWASP MCP Security Cheat Sheet",
  url: "https://cheatsheetseries.owasp.org/cheatsheets/MCP_Security_Cheat_Sheet.html",
};
const OWASP_SSRF: KnowledgeReference = {
  label: "OWASP SSRF Prevention Cheat Sheet",
  url: "https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html",
};

export const KNOWLEDGE_BASE: Record<McpCategory, KnowledgeEntry> = {
  TOOL_POISONING: {
    category: "TOOL_POISONING",
    title: "Tool Poisoning",
    summary:
      "Malicious instructions hidden in tool descriptions, parameter names, JSON schemas, or return values manipulate the LLM's behavior. The entire tool definition is an injection surface, not just its outputs.",
    strideAlignment: ["TAMPERING", "ELEVATION_OF_PRIVILEGE"],
    mitigations: [
      "Treat the entire tool schema as untrusted input — names, descriptions, parameter names, types, enums, and nested schemas are all injection surfaces.",
      "Pin tool definitions at discovery using SHA-256; re-verify the hash immediately before each execution and alert on any drift.",
      "Use strict JSON Schema validation with additionalProperties: false; reject tool invocations that don't conform exactly.",
      "Inspect tool descriptions and parameter names for instruction-like content before registering a server; reject servers whose schemas contain imperative language or markup patterns (<IMPORTANT>, <system>, etc.).",
      "Enforce a tool registry allowlist; unknown or unregistered tools must be rejected, not executed with a warning.",
      "Log the full tool schema hash alongside every invocation so post-incident analysis can detect when a definition changed mid-session.",
    ],
    references: [OWASP_MCP, SPEC_SECURITY],
  },
  CONFUSED_DEPUTY: {
    category: "CONFUSED_DEPUTY",
    title: "Confused Deputy",
    summary:
      "An MCP proxy server acts with its own broad privileges on behalf of a client. With a static upstream client ID plus dynamic client registration and a lingering consent cookie, an attacker can obtain authorization codes without fresh user consent.",
    strideAlignment: ["ELEVATION_OF_PRIVILEGE", "SPOOFING"],
    mitigations: [
      "Validate tool invocation authorization at execution time, not just at session establishment — consent at connection time is not a substitute for per-call authorization checks.",
      'Execute actions with the requesting user\'s permissions, not the server\'s ambient authority; the server should have no privileged actions it can take "on its own."',
      "Require per-client consent stored server-side, checked before forwarding to the third-party authorization server; do not rely on lingering consent cookies.",
      "Exactly match the registered redirect_uri (no wildcards, no prefix matching); reject changes without full re-registration.",
      "Generate a cryptographically random OAuth state parameter, bind it to the session, set it only after consent is confirmed, and validate it as single-use at the callback.",
      "Scope downstream OAuth tokens to the minimum permissions required by the specific tool being invoked — not the server's full authorization.",
      "Never grant Tool B the authority context of Tool A's caller when Tool A's output is passed as Tool B's input; re-authorize each tool invocation independently.",
    ],
    references: [SPEC_SECURITY, SPEC_AUTHZ, OWASP_MCP],
  },
  TOKEN_PASSTHROUGH: {
    category: "TOKEN_PASSTHROUGH",
    title: "Token Passthrough",
    summary:
      "An anti-pattern where the MCP server accepts a token that was not issued for it and forwards it to a downstream API. This bypasses audience checks, breaks audit trails, and lets a stolen token pivot across services.",
    strideAlignment: ["INFO_DISCLOSURE", "SPOOFING"],
    mitigations: [
      "Validate the aud claim on every inbound token; reject any token not explicitly issued to this MCP server — fail closed, never warn-and-continue.",
      "Issue the server its own downstream credentials via client credentials flow or token exchange (RFC 8693) rather than relaying client tokens.",
      "Validate all token claims — audience, scope, issuer, expiry, and nbf — on every request, not just at session establishment.",
      "Maintain per-service token audience separation even for pure proxy servers; this preserves the ability to revoke, rotate, and audit each service boundary independently.",
      "Never log forwarded tokens; treat any token value in logs as a critical finding requiring immediate rotation.",
      "Apply token binding where the downstream service supports it, so forwarded credentials are unusable outside the original TLS session.",
    ],
    references: [SPEC_SECURITY, SPEC_AUTHZ],
  },
  SSRF: {
    category: "SSRF",
    title: "Server-Side Request Forgery",
    summary:
      "Tools or discovery flows that fetch URLs supplied by the LLM or a malicious server can be steered to internal services, cloud metadata endpoints, or localhost — leaking credentials and enabling internal reconnaissance.",
    strideAlignment: ["DOS", "INFO_DISCLOSURE"],
    mitigations: [
      "Resolve and validate destination IPs before making any outbound request; re-resolve within the same connection to defeat DNS rebinding TOCTOU attacks.",
      "Block all private and reserved ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16, ::1, fc00::/7, fe80::/10.",
      "Explicitly block cloud metadata endpoints by IP and hostname: 169.254.169.254, fd00:ec2::254, metadata.google.internal.",
      "Use an egress proxy with an allowlist of permitted external destinations rather than hand-rolled IP parsing — IP parsing is bypassable via IPv6 notation, decimal encoding, and octal forms.",
      "Enforce HTTPS for all fetched URLs; permit http:// only for loopback during local development.",
      "Apply the same validation to redirect targets and any URL derived from tool return values, not just URLs supplied directly in tool parameters.",
      "Cap response sizes and timeouts on all outbound fetches to limit exfiltration and slow-loris DoS.",
    ],
    references: [SPEC_SECURITY, OWASP_MCP, OWASP_SSRF],
  },
  ROGUE_SERVER: {
    category: "ROGUE_SERVER",
    title: "Rogue Server",
    summary:
      "An untrusted or impersonating MCP server is registered or connected — via weak session binding, guessable session IDs, or unclear install consent — and then serves malicious tools or hijacks sessions.",
    strideAlignment: ["SPOOFING", "TAMPERING"],
    mitigations: [
      "Use cryptographically random, non-guessable session IDs (minimum 128 bits of entropy); never sequential, timestamp-derived, or UUIDv1.",
      "Bind sessions to a verified user identity using a composite key such as <user_id>:<session_id> derived from the validated token — never authenticate solely on session ID possession.",
      "Verify server identity before connecting: validate TLS certificates, check server signatures against a known-good registry, and reject self-signed certificates in production.",
      "Present a clear consent dialog naming the server, publisher, and the tools it exposes before establishing a connection; re-prompt whenever tool definitions change.",
      "Implement server reputation checks — publisher identity, signature chain, and known-bad registries — before allowing a new server to register tools.",
      "Rate-limit and alert on repeated server registration attempts from the same origin.",
    ],
    references: [SPEC_SECURITY, OWASP_MCP],
  },
  PROMPT_INJECTION: {
    category: "PROMPT_INJECTION",
    title: "Prompt Injection",
    summary:
      "Attacker-controlled instructions embedded in retrieved documents (RAG) or tool return values redirect the LLM's behavior. All tool responses and retrieved content must be treated as untrusted data, not instructions.",
    strideAlignment: ["TAMPERING", "ELEVATION_OF_PRIVILEGE"],
    mitigations: [
      "Enforce a strict data/instruction boundary: tool responses and RAG content must be delivered in a context that structurally cannot be interpreted as system or user instructions.",
      "Strip instruction-like markup from all tool and RAG outputs before they enter the model context: <IMPORTANT>, <system>, <instruction>, IGNORE PREVIOUS, and similar patterns.",
      "Use content-extraction layers that return typed structured data rather than raw HTML or Markdown.",
      "Log and alert on tool responses containing imperative language patterns, especially those referencing tool names, system prompts, or administrative actions.",
      "Apply human-in-the-loop approval gates before the model executes any tool invocation triggered by externally retrieved content rather than directly by the user.",
      "Treat multi-step agent chains with elevated suspicion — validate user intent at each consequential step, not just the first.",
    ],
    references: [OWASP_MCP, SPEC_SECURITY],
  },
  SUPPLY_CHAIN: {
    category: "SUPPLY_CHAIN",
    title: "Supply Chain",
    summary:
      "A server package is compromised, typosquatted, or performs a 'rug pull' — changing its tool definitions after initial approval to turn a trusted tool malicious.",
    strideAlignment: ["TAMPERING"],
    mitigations: [
      "Pin tool definitions with SHA-256 at installation and re-hash before every execution; treat any hash drift as a critical incident requiring immediate server quarantine.",
      "Verify package integrity via code signing with a trusted key; reject packages without a valid signature from a known publisher.",
      "Install only from verified, curated registries; implement typosquatting detection by checking edit distance against known-good package names before installation.",
      "Scan all dependencies for known vulnerabilities at install time and continuously post-install; integrate with an advisory feed (OSV, GitHub Advisory Database).",
      "Enforce an immutable tool registry in production: tool definitions loaded at startup cannot be updated without a full redeploy and re-approval cycle.",
    ],
    references: [OWASP_MCP],
  },
  DATA_EXFILTRATION: {
    category: "DATA_EXFILTRATION",
    title: "Data Exfiltration",
    summary:
      "Sensitive data (credentials, PII) is smuggled out through legitimate-looking channels — encoded into search queries, email subjects, or tool arguments — often driven by prompt injection.",
    strideAlignment: ["INFO_DISCLOSURE"],
    mitigations: [
      "Centrally log every tool invocation with its full parameter set and session user identity; route to a SIEM with anomaly detection rules for unusual tool usage patterns.",
      "Redact secrets, tokens, and PII from logs and from data returned into the LLM context using a secrets-detection scanner before data enters the context window.",
      "Alert on behavioral anomalies: tool call frequency spikes, new tools invoked for the first time in a session, admin-level queries from non-admin sessions, and unusually large output payloads.",
      "Require explicit human approval for any tool invocation that externalizes data — sending email, writing to external storage, making outbound HTTP requests with user-derived content.",
      "Enforce output size limits on tool responses entering the LLM context.",
      "Treat encoding patterns in tool arguments (base64 strings, unusual Unicode, excessive URL encoding) as exfiltration signals and block or flag automatically.",
    ],
    references: [OWASP_MCP],
  },
  MULTI_TENANCY: {
    category: "MULTI_TENANCY",
    title: "Multi-Tenancy / Context Bleed",
    summary:
      "State or context leaks between tenant sessions on a shared server — one user's data, tools, or session events surface in another user's session, e.g. via shared queues keyed only by session ID.",
    strideAlignment: ["INFO_DISCLOSURE"],
    mitigations: [
      "Key all session-scoped storage, queues, caches, and event streams by <user_id>:<session_id> derived from the verified token — never by client-supplied identifiers alone.",
      "Re-verify authorization on every inbound request at the tool invocation level; do not rely on session presence or prior request authorization as a proxy for current request authorization.",
      "Isolate per-tenant credentials and downstream service scopes at the infrastructure level; never share tokens, connection pools, or credential caches across tenant boundaries.",
      "Apply per-session resource controls — rate limits, memory quotas, context window caps, and timeouts — to prevent one tenant's workload from affecting another's.",
      "In shared infrastructure, use separate process or container isolation per tenant where data sensitivity warrants it; shared-memory architectures require explicit memory scrubbing between sessions.",
      "Audit session isolation in load-balanced and async worker deployments — queues and worker pools are a common source of cross-tenant bleed when keyed only on session ID.",
    ],
    references: [SPEC_SECURITY, OWASP_MCP],
  },
  OTHER: {
    category: "OTHER",
    title: "Other / General",
    summary:
      "General MCP risks not captured by a specific category — including recursive agent loops causing denial of service, message tampering/replay, and over-broad scopes.",
    strideAlignment: ["DOS", "REPUDIATION"],
    mitigations: [
      "Bound agent recursion depth and total tool-call count per session; enforce hard timeouts and per-session quotas to prevent runaway loops or resource exhaustion.",
      "Sign inter-agent messages with a nonce and timestamp; reject duplicate nonces and messages with stale timestamps (recommended window: ±5 minutes) to block replay attacks.",
      "Request minimal, incremental OAuth scopes; reject wildcard or omnibus scopes at registration time.",
      "Validate that tool calls originate from the expected orchestration path — a tool invocation triggered by injected content in a prior tool's output requires elevated scrutiny or explicit re-authorization.",
      "Conduct regular threat modeling sessions as new tools and integrations are added; the MCP attack surface expands with every new tool registration.",
      "Apply least privilege throughout: to tool definitions, OAuth scopes, session permissions, and the server's own infrastructure access.",
    ],
    references: [SPEC_SECURITY, OWASP_MCP],
  },
};

export function getKnowledge(category: McpCategory): KnowledgeEntry {
  return KNOWLEDGE_BASE[category];
}

export const KNOWLEDGE_LIST: KnowledgeEntry[] = Object.values(KNOWLEDGE_BASE);
