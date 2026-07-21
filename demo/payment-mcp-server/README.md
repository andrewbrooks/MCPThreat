# Payment MCP Server (demo)

A small, self-contained **Model Context Protocol** server that exposes payment
operations to an LLM agent. It is bundled with MCPThreat as a realistic example
analysis target — it backs the **Example Payment MCP** project's Architecture and
Dataflow sections.

## What it does

The server presents three tools to a connected agent:

| Tool | Purpose | Downstream |
| --- | --- | --- |
| `charge` | Capture a payment | Payment processor → Ledger |
| `refund` | Reverse a prior charge | Payment processor → Ledger |
| `get_receipt` | Retrieve a receipt document | Receipt RAG store |

## Architecture at a glance

```
LLM agent  ──JSON-RPC / Streamable HTTP──▶  Payment MCP Server ──▶ charge  ─▶ Payment processor
Merchant app ─session init/results──────▶       (Express, /mcp)  ├─▶ refund ─▶ Ledger service
                                                                 └─▶ get_receipt ─▶ Receipt store
```

- **Transport:** Streamable HTTP (`POST /mcp` for requests, `GET /mcp` for the
  server→client event stream), via `@modelcontextprotocol/sdk`.
- **Sessions:** one `McpServer` per session; session ids are cryptographically
  random and bound to the calling merchant (`x-merchant-id`).
- **Downstream auth:** each tool calls downstream systems with the server's own
  scoped credential — client tokens are never forwarded.
- **Egress:** URL fetches are constrained to an allowlist.

## Run it

```bash
npm install
cp .env.example .env
npm run dev        # tsx watch
# or
npm run build && npm start
```

## Layout

```
src/
  server.ts      Express app + Streamable HTTP transport + session routing
  tools.ts       charge / refund / get_receipt tool definitions
  downstream.ts  processor, ledger, and receipt-store clients
  session.ts     per-merchant session store
  config.ts      environment configuration
```

> This is demonstration code, not a production payment system.
