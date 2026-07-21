// The three MCP tools this server exposes to the agent. Each tool has a strict
// Zod input schema (additionalProperties are rejected), performs its downstream
// work through the scoped clients in downstream.ts, and returns a compact result.
//
//   charge      — capture a payment via the processor, then record it in the ledger
//   refund      — reverse a prior charge, then record the refund in the ledger
//   get_receipt — retrieve a receipt document from the RAG store (read-only)

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Config } from "./config.js";
import { LedgerClient, PaymentProcessorClient, ReceiptStore } from "./downstream.js";

export function registerTools(server: McpServer, cfg: Config, merchantId: string): void {
  const processor = new PaymentProcessorClient(cfg);
  const ledger = new LedgerClient(cfg);
  const receipts = new ReceiptStore(cfg);

  server.tool(
    "charge",
    "Capture a payment for the current merchant.",
    {
      amount: z.number().int().positive().describe("Amount in minor units (e.g. cents)."),
      currency: z.string().length(3).describe("ISO 4217 currency code, e.g. USD."),
      cardToken: z.string().min(1).describe("Single-use card token from the client; never a raw PAN."),
    },
    async ({ amount, currency, cardToken }) => {
      const result = await processor.charge(amount, currency, cardToken);
      if (result.status === "succeeded") {
        await ledger.record({ transactionId: result.transactionId, merchantId, amount, kind: "charge" });
      }
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    "refund",
    "Refund a previously captured payment.",
    {
      transactionId: z.string().min(1).describe("The transaction id returned by a prior charge."),
      amount: z.number().int().positive().describe("Amount to refund in minor units."),
    },
    async ({ transactionId, amount }) => {
      const result = await processor.refund(transactionId, amount);
      if (result.status === "succeeded") {
        await ledger.record({ transactionId, merchantId, amount, kind: "refund" });
      }
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    "get_receipt",
    "Retrieve the receipt document for a transaction.",
    {
      transactionId: z.string().min(1).describe("The transaction id to look up."),
    },
    async ({ transactionId }) => {
      const receipt = await receipts.lookup(transactionId);
      if (!receipt) {
        return { content: [{ type: "text", text: "No receipt found." }], isError: true };
      }
      // NOTE: receipt.text originates from a store and is untrusted content that
      // will re-enter the model context (prompt-injection surface).
      return { content: [{ type: "text", text: receipt.text }] };
    },
  );
}
