// Derives the Architecture and Dataflow content for the seeded "Example Payment
// MCP" project from the bundled demo server at demo/payment-mcp-server. The SBOM
// is generated from that server's package.json, so it stays in step with the
// actual dependencies; the prose and dataflow describe the code in that folder.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dataflowSchema, serializeDataflow, type Dataflow } from "../src/lib/dataflow";

const DEMO_DIR = join(process.cwd(), "demo", "payment-mcp-server");

// Short purpose blurbs for the SBOM, keyed by package name.
const PURPOSE: Record<string, string> = {
  "@modelcontextprotocol/sdk": "MCP server SDK for tool registration and the Streamable HTTP transport",
  express: "HTTP server hosting the /mcp endpoint",
  pino: "Structured logging",
  zod: "Strict tool input-schema validation",
  "@types/express": "TypeScript types for Express (dev)",
  "@types/node": "TypeScript types for Node.js (dev)",
  tsx: "TypeScript execution / watch mode (dev)",
  typescript: "TypeScript compiler (dev)",
};

interface DemoPkg {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readDemoPkg(): DemoPkg {
  return JSON.parse(readFileSync(join(DEMO_DIR, "package.json"), "utf8")) as DemoPkg;
}

function sbomTable(pkg: DemoPkg): string {
  const rows: string[] = [
    "| Component | Version | Scope | Purpose |",
    "| --- | --- | --- | --- |",
  ];
  const add = (deps: Record<string, string> | undefined, scope: string) => {
    for (const [name, version] of Object.entries(deps ?? {})) {
      rows.push(`| \`${name}\` | ${version} | ${scope} | ${PURPOSE[name] ?? "-"} |`);
    }
  };
  add(pkg.dependencies, "runtime");
  add(pkg.devDependencies, "dev");
  return rows.join("\n");
}

export interface DemoContent {
  architecture: string;
  techStack: string;
  dataflow: string;
}

export function buildDemoContent(): DemoContent {
  const pkg = readDemoPkg();

  const architecture = `# ${pkg.name} Architecture

_Distilled from the bundled demo repository \`demo/payment-mcp-server\` (v${pkg.version}). This describes the exact server code shipped with MCPThreat, so the component and dependency inventory below is complete._

## Overview

The demo is a **payment-processing MCP server** that exposes payment operations to an LLM agent. It follows the standard MCP **client/server** model: the **agent is the MCP client**, and this process is the **MCP server**. The agent sends JSON-RPC tool calls; the server executes them against downstream payment systems and returns results into the agent's context.

## Client / server model

- **Client:** an LLM agent (and, indirectly, the merchant application that drives it).
- **Server:** a Node.js/TypeScript process built on \`@modelcontextprotocol/sdk\`.
- **Transport:** **Streamable HTTP**. The client \`POST\`s requests to \`/mcp\` and opens a \`GET /mcp\` stream for server→client events. Express hosts both routes (\`src/server.ts\`).
- **Session model:** one \`McpServer\` instance per session. Session ids are cryptographically random (\`node:crypto.randomUUID\`) and bound to the calling merchant via the \`x-merchant-id\` header; a request whose session belongs to a different merchant is refused with 403 (\`src/session.ts\`).

## Components

| Component | File | Responsibility |
| --- | --- | --- |
| HTTP + transport | \`src/server.ts\` | Express app, Streamable HTTP transport, per-session routing |
| Tools | \`src/tools.ts\` | \`charge\`, \`refund\`, \`get_receipt\` tool definitions (strict Zod schemas) |
| Downstream clients | \`src/downstream.ts\` | Payment processor, ledger, and receipt-store clients |
| Session store | \`src/session.ts\` | Per-merchant session creation, resolution, teardown |
| Config | \`src/config.ts\` | Environment config + egress allowlist |

## Tools exposed to the agent

- **\`charge\`** captures a payment via the processor, then records it in the ledger.
- **\`refund\`** reverses a prior charge, then records the refund in the ledger.
- **\`get_receipt\`** retrieves a receipt document from the RAG receipt store (read-only). Returned text re-enters the model context and is treated as untrusted.

## Downstream systems

| System | Trust zone | Access |
| --- | --- | --- |
| Payment processor | External card network | Charges + refunds, via the server's own scoped API key |
| Ledger service | Internal | Append-only transaction records |
| Receipt store | Internal | Read-only RAG lookup of receipts |

All downstream calls use the **server's own scoped credential** (never a client-forwarded token) and are restricted to an **egress allowlist** (\`ALLOWED_EGRESS_HOSTS\`).

## Software Bill of Materials (SBOM)

Generated from \`demo/payment-mcp-server/package.json\`. Runtime is Node.js ≥ 18 (native \`fetch\`); packaged via the bundled \`Dockerfile\`.

${sbomTable(pkg)}

## Trust Boundaries

The deployment crosses five trust boundaries, each modeled in this project's Threat Model:

- **Agent → Server** (LLM to MCP server)
- **Server → Downstream APIs** (MCP server to tools)
- **Server → Client Session** (MCP server to user)
- **Tool Output → Agent Context** (tool output back into the LLM)
- **Third-Party Server Packages** (external / supply chain)`;

  const techStack = [
    "TypeScript",
    "Node.js",
    "@modelcontextprotocol/sdk",
    "Express",
    "Zod",
    "pino",
    "Streamable HTTP",
    "Docker",
  ].join(", ");

  const df: Dataflow = {
    nodes: [
      { id: "agent", label: "LLM Agent (MCP client)", type: "external_entity", tier: 0, trustZone: "Agent runtime" },
      { id: "merchant", label: "Merchant App", type: "external_entity", tier: 0, trustZone: "Client" },
      { id: "mcp", label: "Payment MCP Server", type: "process", tier: 1, trustZone: "Server" },
      { id: "charge", label: "charge tool", type: "process", tier: 2, trustZone: "Server" },
      { id: "refund", label: "refund tool", type: "process", tier: 2, trustZone: "Server" },
      { id: "receipt", label: "get_receipt tool", type: "process", tier: 2, trustZone: "Server" },
      { id: "processor", label: "Payment Processor", type: "external_entity", tier: 3, trustZone: "Card network" },
      { id: "ledger", label: "Ledger Service", type: "datastore", tier: 3, trustZone: "Internal" },
      { id: "store", label: "Receipt Store (RAG)", type: "datastore", tier: 3, trustZone: "Internal" },
    ],
    edges: [
      { id: "e1", from: "agent", to: "mcp", label: "tool call (JSON-RPC)", dataClass: "tool args", crossesBoundary: true },
      { id: "e2", from: "merchant", to: "mcp", label: "session init / results", dataClass: "session", crossesBoundary: true },
      { id: "e3", from: "mcp", to: "charge", label: "dispatch", crossesBoundary: false },
      { id: "e4", from: "mcp", to: "refund", label: "dispatch", crossesBoundary: false },
      { id: "e5", from: "mcp", to: "receipt", label: "dispatch", crossesBoundary: false },
      { id: "e6", from: "charge", to: "processor", label: "charge", dataClass: "card token, amount (PCI)", crossesBoundary: true },
      { id: "e7", from: "charge", to: "ledger", label: "record charge", dataClass: "txn record", crossesBoundary: true },
      { id: "e8", from: "refund", to: "processor", label: "refund", dataClass: "txn id, amount", crossesBoundary: true },
      { id: "e9", from: "refund", to: "ledger", label: "record refund", dataClass: "txn record", crossesBoundary: true },
      { id: "e10", from: "receipt", to: "store", label: "lookup receipt", dataClass: "receipt (PII)", crossesBoundary: true },
      { id: "e11", from: "mcp", to: "agent", label: "tool result", dataClass: "receipt text (untrusted)", crossesBoundary: true },
    ],
  };

  const parsed = dataflowSchema.parse(df); // fail loudly at seed time if malformed
  return { architecture, techStack, dataflow: serializeDataflow(parsed) };
}
