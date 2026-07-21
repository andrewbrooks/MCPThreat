// Payment MCP server entrypoint.
//
// Transport: Streamable HTTP. An LLM agent (the MCP client) POSTs JSON-RPC to
// /mcp; the server negotiates a session, then routes tool calls to the three
// payment tools. One McpServer instance is created per session so tool closures
// capture that session's merchant identity.

import { randomUUID } from "node:crypto";
import express, { type Request, type Response } from "express";
import pino from "pino";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadConfig } from "./config.js";
import { registerTools } from "./tools.js";
import { SessionStore } from "./session.js";

const log = pino({ name: "payment-mcp-server" });
const cfg = loadConfig();
const sessions = new SessionStore();

// Live transports, keyed by MCP session id, so follow-up requests resume the
// right session.
const transports = new Map<string, StreamableHTTPServerTransport>();

// Resolve the merchant from an authenticated header. In production this is a
// verified identity (mTLS / signed JWT with an audience bound to this server) —
// NOT a token blindly forwarded downstream.
function merchantFrom(req: Request): string {
  return String(req.header("x-merchant-id") ?? "demo-merchant");
}

function buildServer(merchantId: string): McpServer {
  const server = new McpServer({ name: "payment-mcp-server", version: "1.0.0" });
  registerTools(server, cfg, merchantId);
  return server;
}

const app = express();
app.use(express.json());

app.post("/mcp", async (req: Request, res: Response) => {
  const existingId = req.header("mcp-session-id");
  const merchantId = merchantFrom(req);

  let transport = existingId ? transports.get(existingId) : undefined;

  if (!transport) {
    // New session.
    const session = sessions.create(merchantId);
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => session.id,
      onsessioninitialized: (id) => transports.set(id, transport!),
    });
    transport.onclose = () => {
      transports.delete(session.id);
      sessions.destroy(session.id);
    };
    const server = buildServer(merchantId);
    await server.connect(transport);
    log.info({ sessionId: session.id, merchantId }, "session initialized");
  } else if (!sessions.resolve(existingId!, merchantId)) {
    // Session exists but is bound to a different merchant — refuse.
    res.status(403).json({ error: "session does not belong to this merchant" });
    return;
  }

  await transport.handleRequest(req, res, req.body);
});

// GET is used by the transport for the server→client event stream.
app.get("/mcp", async (req: Request, res: Response) => {
  const id = req.header("mcp-session-id");
  const transport = id ? transports.get(id) : undefined;
  if (!transport) {
    res.status(400).json({ error: "unknown or missing session" });
    return;
  }
  await transport.handleRequest(req, res);
});

app.listen(cfg.port, () => {
  log.info({ port: cfg.port }, "payment MCP server listening on /mcp");
});
