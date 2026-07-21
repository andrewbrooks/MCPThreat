// Per-connection session store. Sessions are keyed by a server-generated id and,
// in a hardened deployment, must be bound to the authenticated user/merchant so
// one tenant cannot resume or read another's session (see the multi-tenancy and
// rogue-server threat vectors in the bundled threat model).

import { randomUUID } from "node:crypto";

export interface Session {
  id: string;
  merchantId: string;
  createdAt: number;
}

export class SessionStore {
  private sessions = new Map<string, Session>();

  create(merchantId: string): Session {
    // Cryptographically random id — not a guessable sequential integer.
    const session: Session = { id: randomUUID(), merchantId, createdAt: Date.now() };
    this.sessions.set(session.id, session);
    return session;
  }

  // Resolve a session, verifying it belongs to the calling merchant. Returns null
  // when the session is unknown or bound to a different tenant.
  resolve(sessionId: string, merchantId: string): Session | null {
    const s = this.sessions.get(sessionId);
    if (!s || s.merchantId !== merchantId) return null;
    return s;
  }

  destroy(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
