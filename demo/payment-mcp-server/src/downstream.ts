// Clients for the three downstream systems the payment tools talk to:
//   1. Payment processor  — external card-network gateway (charges/refunds)
//   2. Ledger service     — internal double-entry ledger of record
//   3. Receipt store       — RAG document store of receipts (read-only lookup)
//
// Each call uses the SERVER's own scoped credential, never a token forwarded
// from the client, and only reaches hosts on the egress allowlist.

import type { Config } from "./config.js";

export interface ChargeResult {
  transactionId: string;
  status: "succeeded" | "declined";
  amount: number;
  currency: string;
}

export interface RefundResult {
  refundId: string;
  status: "succeeded" | "failed";
  amount: number;
}

export interface Receipt {
  transactionId: string;
  text: string;
}

function assertAllowed(url: string, cfg: Config): void {
  const host = new URL(url).hostname;
  if (!cfg.allowedEgressHosts.includes(host)) {
    throw new Error(`egress to ${host} is not on the allowlist`);
  }
}

export class PaymentProcessorClient {
  constructor(private cfg: Config) {}

  async charge(amount: number, currency: string, cardToken: string): Promise<ChargeResult> {
    assertAllowed(this.cfg.processorUrl, this.cfg);
    const res = await fetch(`${this.cfg.processorUrl}/v1/charges`, {
      method: "POST",
      headers: {
        // Server-owned key, scoped to this server's processor account.
        authorization: `Bearer ${this.cfg.processorApiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ amount, currency, source: cardToken }),
    });
    const data = (await res.json()) as ChargeResult;
    return data;
  }

  async refund(transactionId: string, amount: number): Promise<RefundResult> {
    assertAllowed(this.cfg.processorUrl, this.cfg);
    const res = await fetch(`${this.cfg.processorUrl}/v1/refunds`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.cfg.processorApiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ transaction: transactionId, amount }),
    });
    return (await res.json()) as RefundResult;
  }
}

export class LedgerClient {
  constructor(private cfg: Config) {}

  async record(entry: { transactionId: string; merchantId: string; amount: number; kind: "charge" | "refund" }): Promise<void> {
    assertAllowed(this.cfg.ledgerUrl, this.cfg);
    await fetch(`${this.cfg.ledgerUrl}/v1/entries`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(entry),
    });
  }
}

export class ReceiptStore {
  constructor(private cfg: Config) {}

  // Retrieval-augmented lookup of a receipt document. Returned text flows back
  // into the agent's context, so it is untrusted from the model's perspective.
  async lookup(transactionId: string): Promise<Receipt | null> {
    assertAllowed(this.cfg.receiptStoreUrl, this.cfg);
    const res = await fetch(
      `${this.cfg.receiptStoreUrl}/v1/receipts/${encodeURIComponent(transactionId)}`,
    );
    if (!res.ok) return null;
    return (await res.json()) as Receipt;
  }
}
