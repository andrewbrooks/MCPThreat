# Example Payment MCP

**Threat model report**

MCP server: https://payments.example.com/mcp

**Live draft**

### Document control

| Item | Value |
| --- | --- |
| Version | Live draft (not a numbered version) |
| Date generated | 2026-11-14 14:18 UTC |
| Report format version | 1.0 |
| Tool and version | MCPThreat 1.0.0 |
| Risk-acceptance policy | Dual sign-off (assessor + client) |

### Review and sign-off

| Item | Value |
| --- | --- |
| Prepared by | Demo User \<demo@example.com> |
| Review status | Not reviewed. This is a live draft. |

> This is a live draft. It reflects the threat model as it is now and will change as the model is edited. A frozen, reviewed record is made from the Review and sign-off page of the project.

## Executive summary

Example Payment MCP has 5 trust boundaries, 10 threat vectors and 6 findings. 3 findings are open, including 1 Critical and 1 High.

### Findings by severity

| Severity | Total | Open |
| --- | --- | --- |
| Critical | 2 | 1 |
| High | 2 | 1 |
| Medium | 1 | 1 |
| Low | 1 | 0 |
| Info | 0 | 0 |

### Findings by status

| Status | Findings | Share |
| --- | --- | --- |
| Open | 2 | 33% |
| In Progress | 1 | 17% |
| Pending Acceptance | 0 | 0% |
| Mitigated | 1 | 17% |
| Accepted | 1 | 17% |
| Closed | 1 | 17% |

### Threat vector risk matrix

Threat vectors by likelihood and impact (10 in total). Each cell shows the number of threat vectors and the risk band.

| Likelihood by impact | Low impact | Medium impact | High impact |
| --- | --- | --- | --- |
| High likelihood | 0 (Medium risk) | 1 (High risk) | 1 (Critical risk) |
| Medium likelihood | 0 (Low risk) | 1 (Medium risk) | 5 (High risk) |
| Low likelihood | 0 (Low risk) | 0 (Low risk) | 2 (Medium risk) |

### Open findings requiring attention

| ID | Severity | Finding | Owner | Due |
| --- | --- | --- | --- | --- |
| F-001 | Critical | Tool schemas are not pinned or hash-verified | security@example.com | 2026-11-28 |
| F-002 | High | Client tokens forwarded to processor without audience validation | platform@example.com | 2026-12-14 |
| F-004 | Medium | Session IDs are sequential and not bound to user identity | — | 2026-12-29 |

### Key observations

- 4 threat vectors have no finding.
- 1 open finding has no owner.

These observations are checks on the record. They are not an assessment of the system.

## Contents

Executive summary
1. Assessment record
2. Scope and limitations
3. Summary
4. Architecture
5. Trust boundaries
6. Threat vectors
7. Findings register
8. Finding details
9. Framework mapping
10. Recommended controls
11. Definitions

## 1. Assessment record

| Item | Value |
| --- | --- |
| Project | Example Payment MCP |
| Project status | Active |
| Description | A sample threat model for a payment-processing MCP server exposing charge, refund, and receipt tools to an LLM agent. |
| MCP server | https://payments.example.com/mcp |
| Model source | Entered manually in MCPThreat |
| Technology | TypeScript, Node.js, @modelcontextprotocol/sdk, Express, Zod, pino, Streamable HTTP, Docker |
| Model created | 2026-11-14 03:13 UTC |
| Last change recorded | 2026-11-14 04:20 UTC |
| Report generated | 2026-11-14 14:18 UTC |
| Tool and version | MCPThreat 1.0.0 |
| Risk-acceptance policy | Dual sign-off (assessor + client) |
| AI-suggested items | 0 boundaries, 0 threat vectors, 0 findings |
| Audit trail | 0 events |

**People with access**

| Person | Role | Party |
| --- | --- | --- |
| Demo User \<demo@example.com> | Owner | Assessor |
| client@example.com | Member | Client |

## 2. Scope and limitations

This report describes the threat model recorded in MCPThreat for the project named above: its trust boundaries, threat vectors, findings, and the status of each finding at the time of export.

It records what the assessors entered or reviewed. It does not record what was tested, because MCPThreat does not connect to or test the MCP server.

**Limitations. Please read before relying on this report.**

- This is a threat model, not a penetration test, code audit, vulnerability scan, or compliance assessment. The absence of a finding does not mean the absence of a weakness.
- Coverage depends on the trust boundaries and threat vectors that were modeled. Threats outside the MCP and STRIDE categories used here are recorded under Other, or not at all.
- Items marked AI-suggested were drafted by a language model from repository contents. They may be incomplete or wrong, and should be confirmed by a person before they are relied on.
- Severity ratings and likelihood and impact levels are judgements entered by people. The risk band is a fixed calculation from those inputs.
- Framework mappings are indicative cross-references. They are not a certification or attestation against OWASP, MITRE ATLAS, or any other framework.
- Status, ownership, and acceptance decisions reflect what was recorded in MCPThreat. Evidence referenced here has not been independently verified by the tool.

## 3. Summary

Example Payment MCP has 5 trust boundaries, 10 threat vectors, and 6 findings, of which 3 are open. Mitigation completion is 20%. Counts by severity and status are in the executive summary at the start of this report. Definitions of "open" and "completion" are in section 11.

| Threat vector risk band | Vectors |
| --- | --- |
| Critical | 1 |
| High | 6 |
| Medium | 3 |
| Low | 0 |

## 4. Architecture

### payment-mcp-server Architecture

_Distilled from the bundled demo repository `demo/payment-mcp-server` (v1.0.0). This describes the exact server code shipped with MCPThreat, so the component and dependency inventory below is complete._

#### Overview

The demo is a **payment-processing MCP server** that exposes payment operations to an LLM agent. It follows the standard MCP **client/server** model: the **agent is the MCP client**, and this process is the **MCP server**. The agent sends JSON-RPC tool calls; the server executes them against downstream payment systems and returns results into the agent's context.

#### Client / server model

- **Client:** an LLM agent (and, indirectly, the merchant application that drives it).
- **Server:** a Node.js/TypeScript process built on `@modelcontextprotocol/sdk`.
- **Transport:** **Streamable HTTP**. The client `POST`s requests to `/mcp` and opens a `GET /mcp` stream for server→client events. Express hosts both routes (`src/server.ts`).
- **Session model:** one `McpServer` instance per session. Session ids are cryptographically random (`node:crypto.randomUUID`) and bound to the calling merchant via the `x-merchant-id` header; a request whose session belongs to a different merchant is refused with 403 (`src/session.ts`).

#### Components

| Component | File | Responsibility |
| --- | --- | --- |
| HTTP + transport | `src/server.ts` | Express app, Streamable HTTP transport, per-session routing |
| Tools | `src/tools.ts` | `charge`, `refund`, `get_receipt` tool definitions (strict Zod schemas) |
| Downstream clients | `src/downstream.ts` | Payment processor, ledger, and receipt-store clients |
| Session store | `src/session.ts` | Per-merchant session creation, resolution, teardown |
| Config | `src/config.ts` | Environment config + egress allowlist |

#### Tools exposed to the agent

- **`charge`** captures a payment via the processor, then records it in the ledger.
- **`refund`** reverses a prior charge, then records the refund in the ledger.
- **`get_receipt`** retrieves a receipt document from the RAG receipt store (read-only). Returned text re-enters the model context and is treated as untrusted.

#### Downstream systems

| System | Trust zone | Access |
| --- | --- | --- |
| Payment processor | External card network | Charges + refunds, via the server's own scoped API key |
| Ledger service | Internal | Append-only transaction records |
| Receipt store | Internal | Read-only RAG lookup of receipts |

All downstream calls use the **server's own scoped credential** (never a client-forwarded token) and are restricted to an **egress allowlist** (`ALLOWED_EGRESS_HOSTS`).

#### Software Bill of Materials (SBOM)

Generated from `demo/payment-mcp-server/package.json`. Runtime is Node.js ≥ 18 (native `fetch`); packaged via the bundled `Dockerfile`.

| Component | Version | Scope | Purpose |
| --- | --- | --- | --- |
| `@modelcontextprotocol/sdk` | ^1.11.0 | runtime | MCP server SDK for tool registration and the Streamable HTTP transport |
| `express` | ^4.19.2 | runtime | HTTP server hosting the /mcp endpoint |
| `pino` | ^9.3.2 | runtime | Structured logging |
| `zod` | ^3.23.8 | runtime | Strict tool input-schema validation |
| `@types/express` | ^4.17.21 | dev | TypeScript types for Express (dev) |
| `@types/node` | ^20.14.0 | dev | TypeScript types for Node.js (dev) |
| `tsx` | ^4.16.2 | dev | TypeScript execution / watch mode (dev) |
| `typescript` | ^5.5.4 | dev | TypeScript compiler (dev) |

#### Trust Boundaries

The deployment crosses five trust boundaries, each modeled in this project's Threat Model:

- **Agent → Server** (LLM to MCP server)
- **Server → Downstream APIs** (MCP server to tools)
- **Server → Client Session** (MCP server to user)
- **Tool Output → Agent Context** (tool output back into the LLM)
- **Third-Party Server Packages** (external / supply chain)

## 5. Trust boundaries

### B-01: Agent → Payment MCP Server

Type: LLM → MCP Server.

The boundary where the LLM agent issues tool calls to the payment MCP server. Requests originate from model reasoning that may be influenced by untrusted context.

- T-01: LLM privilege escalation to higher-privilege tools (Elevation of Privilege; Confused Deputy)
- T-02: Recursive agent loop causing denial of service (Denial of Service; Other)

### B-02: Payment MCP Server → Downstream APIs

Type: MCP Server → Tool / Downstream API.

The boundary where the MCP server calls downstream payment processors, ledgers, and internal services on behalf of a tool invocation.

- T-03: Token passthrough to unintended downstream services (Information Disclosure; Token Passthrough)
- T-04: SSRF via tool-supplied URLs (Denial of Service; Server-Side Request Forgery)

### B-03: Payment MCP Server → User / Client Session

Type: MCP Server → User.

The boundary where the server establishes and maintains client sessions and returns results to the end user.

- T-05: Rogue server registration via weak session binding (Spoofing; Rogue Server)
- T-06: Context bleed between tenant sessions (Information Disclosure; Multi-Tenancy / Context Bleed)

### B-04: Tool Output → Agent Context

Type: Tool Output → LLM Context.

The boundary where tool results and retrieved documents flow back into the LLM context, where they may be interpreted as instructions.

- T-07: Tool poisoning via schema injection (Tampering; Tool Poisoning)
- T-08: Prompt injection via RAG/retrieved documents (Tampering; Prompt Injection)
- T-09: Credential exfiltration via tool output (Information Disclosure; Data Exfiltration)

### B-05: External / Third-Party Server Packages

Type: External / Third-Party.

The boundary where third-party MCP server packages and their updates are trusted and installed.

- T-10: Rug-pull supply chain update (Tampering; Supply Chain)

## 6. Threat vectors

| ID | Threat vector | Boundary | STRIDE | MCP category | Likelihood | Impact | Risk | Residual | Findings | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T-01 | LLM privilege escalation to higher-privilege tools | B-01 | Elevation of Privilege | Confused Deputy | Medium | High | High | High | — | Manual |
| T-02 | Recursive agent loop causing denial of service | B-01 | Denial of Service | Other | Medium | Medium | Medium | Low | F-006 | Manual |
| T-03 | Token passthrough to unintended downstream services | B-02 | Information Disclosure | Token Passthrough | Medium | High | High | High | F-002 | Manual |
| T-04 | SSRF via tool-supplied URLs | B-02 | Denial of Service | Server-Side Request Forgery | High | High | Critical | High | F-003 | Manual |
| T-05 | Rogue server registration via weak session binding | B-03 | Spoofing | Rogue Server | Medium | High | High | High | F-004 | Manual |
| T-06 | Context bleed between tenant sessions | B-03 | Information Disclosure | Multi-Tenancy / Context Bleed | Low | High | Medium | Medium | — | Manual |
| T-07 | Tool poisoning via schema injection | B-04 | Tampering | Tool Poisoning | Medium | High | High | High | F-001 | Manual |
| T-08 | Prompt injection via RAG/retrieved documents | B-04 | Tampering | Prompt Injection | High | Medium | High | High | — | Manual |
| T-09 | Credential exfiltration via tool output | B-04 | Information Disclosure | Data Exfiltration | Medium | High | High | High | F-005 | Manual |
| T-10 | Rug-pull supply chain update | B-05 | Tampering | Supply Chain | Low | High | Medium | Medium | — | Manual |

## 7. Findings register

Ordered by severity, then identifier.

| ID | Severity | Status | Finding | Threat vector | Owner | Due |
| --- | --- | --- | --- | --- | --- | --- |
| F-001 | Critical | Open | Tool schemas are not pinned or hash-verified | T-07 | security@example.com | 2026-11-28 |
| F-005 | Critical | Accepted | No egress logging or PII redaction on tool outputs | T-09 | ciso@example.com | — |
| F-002 | High | In Progress | Client tokens forwarded to processor without audience validation | T-03 | platform@example.com | 2026-12-14 |
| F-003 | High | Mitigated | Webhook URL parameter fetched without allowlist | T-04 | platform@example.com | 2026-11-09 |
| F-004 | Medium | Open | Session IDs are sequential and not bound to user identity | T-05 | — | 2026-12-29 |
| F-006 | Low | Closed | No recursion depth or per-session call quota | T-02 | platform@example.com | 2026-10-25 |

## 8. Finding details

### F-001: Tool schemas are not pinned or hash-verified

- **Severity:** Critical
- **Status:** Open
- **Threat vector:** T-07 Tool poisoning via schema injection (Tool Poisoning)
- **Owner:** security@example.com
- **Due:** 2026-11-28
- **Source:** Entered by a person
- **Framework mapping (indicative):** LLM01, LLM04, LLM05, AML.T0051, AML.T0053
- **Recorded:** 2026-11-14 03:13 UTC. **Last updated:** 2026-11-14 03:13 UTC

**Description and rationale**

Tool descriptions and parameter schemas are consumed as-is at runtime with no integrity check, leaving the agent open to injected instructions.

**Recommendation**

Pin tool definitions at discovery with SHA-256, re-hash before execution and alert on drift. Enforce strict JSON Schema with additionalProperties: false.

**Evidence**

Runtime capture shows tool descriptions passed to the model without validation.

### F-005: No egress logging or PII redaction on tool outputs

- **Severity:** Critical
- **Status:** Accepted
- **Threat vector:** T-09 Credential exfiltration via tool output (Data Exfiltration)
- **Owner:** ciso@example.com
- **Due:** —
- **Review due:** 2027-02-12
- **Source:** Entered by a person
- **Framework mapping (indicative):** LLM02, AML.T0024, AML.T0025
- **Recorded:** 2026-11-14 03:13 UTC. **Last updated:** 2026-11-14 03:13 UTC

**Description and rationale**

Tool outputs are returned to the model with no centralized logging or secret/PII redaction, enabling covert exfiltration.

**Recommendation**

Centrally log all tool invocations with parameters into a SIEM, redact secrets/PII, and require human approval for data-sharing operations.

**Evidence**

Risk formally accepted for Q3 pending SIEM rollout; compensating manual review in place.

### F-002: Client tokens forwarded to processor without audience validation

- **Severity:** High
- **Status:** In Progress
- **Threat vector:** T-03 Token passthrough to unintended downstream services (Token Passthrough)
- **Owner:** platform@example.com
- **Due:** 2026-12-14
- **Source:** Entered by a person
- **Framework mapping (indicative):** LLM02, LLM06, AML.T0025
- **Recorded:** 2026-11-14 03:13 UTC. **Last updated:** 2026-11-14 03:13 UTC

**Description and rationale**

The server relays the client's bearer token to the payment processor without checking the token audience.

**Recommendation**

Never accept tokens not issued to the server. Validate the audience claim and issue the server its own scoped downstream credentials.

**Evidence**

Code review of downstream.ts confirms Authorization header is passed through verbatim.

### F-003: Webhook URL parameter fetched without allowlist

- **Severity:** High
- **Status:** Mitigated
- **Threat vector:** T-04 SSRF via tool-supplied URLs (Server-Side Request Forgery)
- **Owner:** platform@example.com
- **Due:** 2026-11-09
- **Source:** Entered by a person
- **Framework mapping (indicative):** LLM06, LLM05, AML.T0048
- **Recorded:** 2026-11-14 03:13 UTC. **Last updated:** 2026-11-14 03:13 UTC

**Description and rationale**

The receipt-webhook tool fetched arbitrary URLs, including internal ranges, before remediation.

**Recommendation**

Enforce HTTPS, block private/reserved ranges and 169.254.169.254, validate redirect targets, and pin DNS between check and use.

**Evidence**

Egress allowlist and private-range blocklist deployed in v2.3.1; verified against metadata endpoint.

### F-004: Session IDs are sequential and not bound to user identity

- **Severity:** Medium
- **Status:** Open
- **Threat vector:** T-05 Rogue server registration via weak session binding (Rogue Server)
- **Owner:** —
- **Due:** 2026-12-29
- **Source:** Entered by a person
- **Framework mapping (indicative):** LLM03, AML.T0010, AML.T0053
- **Recorded:** 2026-11-14 03:13 UTC. **Last updated:** 2026-11-14 03:13 UTC

**Description and rationale**

Session identifiers are incremental integers and sessions are treated as authentication on their own.

**Recommendation**

Use cryptographically random session IDs, key session storage by \<user_id>:\<session_id>, and verify authorization on every request.

**Evidence**

Observed session IDs 1001, 1002, 1003 across test connections.

### F-006: No recursion depth or per-session call quota

- **Severity:** Low
- **Status:** Closed
- **Threat vector:** T-02 Recursive agent loop causing denial of service (Other)
- **Owner:** platform@example.com
- **Due:** 2026-10-25
- **Source:** Entered by a person
- **Framework mapping (indicative):** LLM10, LLM06, AML.T0048
- **Recorded:** 2026-11-14 03:13 UTC. **Last updated:** 2026-11-14 04:20 UTC

**Description and rationale**

A retry loop in the charge tool could recurse without bound, exhausting downstream quotas.

**Recommendation**

Bound tool-call depth and recursion, enforce per-session quotas and timeouts, and add circuit breakers on downstream failures.

**Evidence**

Depth cap (max 5) and per-session rate limit shipped in v2.2.0; load test confirms no runaway.

## 9. Framework mapping

Mapping only. Each MCP threat category is cross-referenced to the OWASP Top 10 for LLM Applications (2025) and MITRE ATLAS. These are indicative references to help locate related guidance. They are not a certification, attestation, or assessment of compliance against either framework.

| Framework | Reference | Name | Threat vectors |
| --- | --- | --- | --- |
| OWASP Top 10 for LLM Applications (2025) | LLM01 | Prompt Injection | T-07, T-08 |
| OWASP Top 10 for LLM Applications (2025) | LLM02 | Sensitive Information Disclosure | T-03, T-06, T-09 |
| OWASP Top 10 for LLM Applications (2025) | LLM03 | Supply Chain | T-05, T-10 |
| OWASP Top 10 for LLM Applications (2025) | LLM04 | Data and Model Poisoning | T-07, T-10 |
| OWASP Top 10 for LLM Applications (2025) | LLM05 | Improper Output Handling | T-04, T-07 |
| OWASP Top 10 for LLM Applications (2025) | LLM06 | Excessive Agency | T-01, T-02, T-03, T-04 |
| OWASP Top 10 for LLM Applications (2025) | LLM10 | Unbounded Consumption | T-02 |
| MITRE ATLAS | AML.T0010 | ML Supply Chain Compromise | T-05, T-10 |
| MITRE ATLAS | AML.T0024 | Exfiltration via ML Inference API | T-06, T-09 |
| MITRE ATLAS | AML.T0025 | Exfiltration via Cyber Means | T-03, T-09 |
| MITRE ATLAS | AML.T0048 | External Harms | T-02, T-04 |
| MITRE ATLAS | AML.T0051 | LLM Prompt Injection | T-07, T-08 |
| MITRE ATLAS | AML.T0053 | LLM Plugin Compromise | T-01, T-05, T-07 |
| MITRE ATLAS | AML.T0054 | LLM Jailbreak | T-08 |

## 10. Recommended controls

General guidance for each MCP category present in the model. It is not specific to any one finding.

### Confused Deputy

- Validate tool invocation authorization at execution time, not just at session establishment — consent at connection time is not a substitute for per-call authorization checks.
- Execute actions with the requesting user's permissions, not the server's ambient authority; the server should have no privileged actions it can take "on its own."
- Require per-client consent stored server-side, checked before forwarding to the third-party authorization server; do not rely on lingering consent cookies.
- Exactly match the registered redirect_uri (no wildcards, no prefix matching); reject changes without full re-registration.
- Generate a cryptographically random OAuth state parameter, bind it to the session, set it only after consent is confirmed, and validate it as single-use at the callback.
- Scope downstream OAuth tokens to the minimum permissions required by the specific tool being invoked — not the server's full authorization.
- Never grant Tool B the authority context of Tool A's caller when Tool A's output is passed as Tool B's input; re-authorize each tool invocation independently.

### Other / General

- Bound agent recursion depth and total tool-call count per session; enforce hard timeouts and per-session quotas to prevent runaway loops or resource exhaustion.
- Sign inter-agent messages with a nonce and timestamp; reject duplicate nonces and messages with stale timestamps (recommended window: ±5 minutes) to block replay attacks.
- Request minimal, incremental OAuth scopes; reject wildcard or omnibus scopes at registration time.
- Validate that tool calls originate from the expected orchestration path — a tool invocation triggered by injected content in a prior tool's output requires elevated scrutiny or explicit re-authorization.
- Conduct regular threat modeling sessions as new tools and integrations are added; the MCP attack surface expands with every new tool registration.
- Apply least privilege throughout: to tool definitions, OAuth scopes, session permissions, and the server's own infrastructure access.

### Token Passthrough

- Validate the aud claim on every inbound token; reject any token not explicitly issued to this MCP server — fail closed, never warn-and-continue.
- Issue the server its own downstream credentials via client credentials flow or token exchange (RFC 8693) rather than relaying client tokens.
- Validate all token claims — audience, scope, issuer, expiry, and nbf — on every request, not just at session establishment.
- Maintain per-service token audience separation even for pure proxy servers; this preserves the ability to revoke, rotate, and audit each service boundary independently.
- Never log forwarded tokens; treat any token value in logs as a critical finding requiring immediate rotation.
- Apply token binding where the downstream service supports it, so forwarded credentials are unusable outside the original TLS session.

### Server-Side Request Forgery

- Resolve and validate destination IPs before making any outbound request; re-resolve within the same connection to defeat DNS rebinding TOCTOU attacks.
- Block all private and reserved ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16, ::1, fc00::/7, fe80::/10.
- Explicitly block cloud metadata endpoints by IP and hostname: 169.254.169.254, fd00:ec2::254, metadata.google.internal.
- Use an egress proxy with an allowlist of permitted external destinations rather than hand-rolled IP parsing — IP parsing is bypassable via IPv6 notation, decimal encoding, and octal forms.
- Enforce HTTPS for all fetched URLs; permit http:// only for loopback during local development.
- Apply the same validation to redirect targets and any URL derived from tool return values, not just URLs supplied directly in tool parameters.
- Cap response sizes and timeouts on all outbound fetches to limit exfiltration and slow-loris DoS.

### Rogue Server

- Use cryptographically random, non-guessable session IDs (minimum 128 bits of entropy); never sequential, timestamp-derived, or UUIDv1.
- Bind sessions to a verified user identity using a composite key such as \<user_id>:\<session_id> derived from the validated token — never authenticate solely on session ID possession.
- Verify server identity before connecting: validate TLS certificates, check server signatures against a known-good registry, and reject self-signed certificates in production.
- Present a clear consent dialog naming the server, publisher, and the tools it exposes before establishing a connection; re-prompt whenever tool definitions change.
- Implement server reputation checks — publisher identity, signature chain, and known-bad registries — before allowing a new server to register tools.
- Rate-limit and alert on repeated server registration attempts from the same origin.

### Multi-Tenancy / Context Bleed

- Key all session-scoped storage, queues, caches, and event streams by \<user_id>:\<session_id> derived from the verified token — never by client-supplied identifiers alone.
- Re-verify authorization on every inbound request at the tool invocation level; do not rely on session presence or prior request authorization as a proxy for current request authorization.
- Isolate per-tenant credentials and downstream service scopes at the infrastructure level; never share tokens, connection pools, or credential caches across tenant boundaries.
- Apply per-session resource controls — rate limits, memory quotas, context window caps, and timeouts — to prevent one tenant's workload from affecting another's.
- In shared infrastructure, use separate process or container isolation per tenant where data sensitivity warrants it; shared-memory architectures require explicit memory scrubbing between sessions.
- Audit session isolation in load-balanced and async worker deployments — queues and worker pools are a common source of cross-tenant bleed when keyed only on session ID.

### Tool Poisoning

- Treat the entire tool schema as untrusted input — names, descriptions, parameter names, types, enums, and nested schemas are all injection surfaces.
- Pin tool definitions at discovery using SHA-256; re-verify the hash immediately before each execution and alert on any drift.
- Use strict JSON Schema validation with additionalProperties: false; reject tool invocations that don't conform exactly.
- Inspect tool descriptions and parameter names for instruction-like content before registering a server; reject servers whose schemas contain imperative language or markup patterns (\<IMPORTANT>, \<system>, etc.).
- Enforce a tool registry allowlist; unknown or unregistered tools must be rejected, not executed with a warning.
- Log the full tool schema hash alongside every invocation so post-incident analysis can detect when a definition changed mid-session.

### Prompt Injection

- Enforce a strict data/instruction boundary: tool responses and RAG content must be delivered in a context that structurally cannot be interpreted as system or user instructions.
- Strip instruction-like markup from all tool and RAG outputs before they enter the model context: \<IMPORTANT>, \<system>, \<instruction>, IGNORE PREVIOUS, and similar patterns.
- Use content-extraction layers that return typed structured data rather than raw HTML or Markdown.
- Log and alert on tool responses containing imperative language patterns, especially those referencing tool names, system prompts, or administrative actions.
- Apply human-in-the-loop approval gates before the model executes any tool invocation triggered by externally retrieved content rather than directly by the user.
- Treat multi-step agent chains with elevated suspicion — validate user intent at each consequential step, not just the first.

### Data Exfiltration

- Centrally log every tool invocation with its full parameter set and session user identity; route to a SIEM with anomaly detection rules for unusual tool usage patterns.
- Redact secrets, tokens, and PII from logs and from data returned into the LLM context using a secrets-detection scanner before data enters the context window.
- Alert on behavioral anomalies: tool call frequency spikes, new tools invoked for the first time in a session, admin-level queries from non-admin sessions, and unusually large output payloads.
- Require explicit human approval for any tool invocation that externalizes data — sending email, writing to external storage, making outbound HTTP requests with user-derived content.
- Enforce output size limits on tool responses entering the LLM context.
- Treat encoding patterns in tool arguments (base64 strings, unusual Unicode, excessive URL encoding) as exfiltration signals and block or flag automatically.

### Supply Chain

- Pin tool definitions with SHA-256 at installation and re-hash before every execution; treat any hash drift as a critical incident requiring immediate server quarantine.
- Verify package integrity via code signing with a trusted key; reject packages without a valid signature from a known publisher.
- Install only from verified, curated registries; implement typosquatting detection by checking edit distance against known-good package names before installation.
- Scan all dependencies for known vulnerabilities at install time and continuously post-install; integrate with an advisory feed (OSV, GitHub Advisory Database).
- Enforce an immutable tool registry in production: tool definitions loaded at startup cannot be updated without a full redeploy and re-approval cycle.

## 11. Definitions

- **Open finding.** A finding whose status is Open, In Progress, or Pending Acceptance. Mitigated, Accepted, and Closed findings are not counted as open.
- **Mitigation completion.** The share of threat vectors that have at least one finding with status Mitigated or Closed. A vector with no findings does not count as complete. An Accepted finding does not count toward completion.
- **Risk band.** Derived from the threat vector's likelihood and impact (Low = 1, Medium = 2, High = 3). The product gives a score from 1 to 9: 1 to 2 is Low, 3 to 5 is Medium, 6 to 8 is High, and 9 is Critical.
- **Residual risk band.** The risk band after reducing the score by 3 (to a minimum of 1) when the vector has at least one Mitigated or Closed finding. It is a simple adjustment, not a re-assessment.
- **Snapshot.** A frozen copy of the assessment taken at a point in time and given a version number. Its SHA-256 content hash identifies exactly what was assessed, so any later change to the content gives a different hash. The hash is not a digital signature and does not prove who produced it.
- **Severity.** The assessor's rating of an individual finding (Info, Low, Medium, High, Critical). It is recorded by a person and is not calculated from the risk band.
- **AI-suggested.** An item drafted by a language model from repository contents during GitHub import. It carries a confidence level (Low, Medium, High) and is intended to be reviewed by a person.
- **Identifiers.** B-nn (trust boundary), T-nn (threat vector), and F-nnn (finding) are assigned by creation order within the project at the time of export. They are stable while items are only added or edited. Deleting an item renumbers later items of the same kind, so cite the export date and tool version alongside an identifier, or use the internal uid in the JSON export.
