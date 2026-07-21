// Runtime configuration for the payment MCP server. Values come from the
// environment; sensible localhost defaults keep the demo runnable out of the box.

export interface Config {
  port: number;
  processorUrl: string;
  ledgerUrl: string;
  receiptStoreUrl: string;
  // Downstream credential the server holds on its own behalf. It must NOT be a
  // pass-through of the client's token — see the threat model.
  processorApiKey: string;
  // Egress allowlist for any tool that fetches a URL (receipt webhooks, etc.).
  allowedEgressHosts: string[];
}

export function loadConfig(): Config {
  return {
    port: Number(process.env.PORT ?? 8848),
    processorUrl: process.env.PROCESSOR_URL ?? "https://processor.internal.local",
    ledgerUrl: process.env.LEDGER_URL ?? "https://ledger.internal.local",
    receiptStoreUrl: process.env.RECEIPT_STORE_URL ?? "https://receipts.internal.local",
    processorApiKey: process.env.PROCESSOR_API_KEY ?? "sk_demo_processor_key",
    allowedEgressHosts: (process.env.ALLOWED_EGRESS_HOSTS ?? "processor.internal.local,ledger.internal.local,receipts.internal.local")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean),
  };
}
