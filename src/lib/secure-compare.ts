import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Compare two secrets without leaking where they differ, or how long they are, through
 * timing. Both values are hashed first so the comparison is always over equal-length
 * buffers. Use this for tokens and shared secrets, never plain `===`.
 */
export function safeEqual(a: string, b: string): boolean {
  const digest = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(digest(a), digest(b));
}
