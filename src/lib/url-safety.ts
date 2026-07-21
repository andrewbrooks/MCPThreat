// SSRF-safe validation for user-supplied MCP server URLs. MCPThreat never
// auto-fetches these URLs; this guard is defense-in-depth so any future preview
// fetch is forced through the same checks. It rejects non-HTTP(S) schemes and
// hostnames that resolve to private, loopback, link-local, or cloud-metadata ranges.

export interface UrlCheckResult {
  ok: boolean;
  reason?: string;
  normalized?: string;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
]);

// Cloud metadata + common local service addresses that must always be blocked.
const BLOCKED_EXACT_IPS = new Set(["169.254.169.254", "0.0.0.0", "::", "::1", "[::1]"]);

function ipv4ToLong(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value >>> 0;
}

function isPrivateIpv4(ip: string): boolean {
  const long = ipv4ToLong(ip);
  if (long === null) return false;
  const inRange = (base: string, maskBits: number) => {
    const baseLong = ipv4ToLong(base)!;
    const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;
    return (long & mask) === (baseLong & mask);
  };
  return (
    inRange("10.0.0.0", 8) ||
    inRange("172.16.0.0", 12) ||
    inRange("192.168.0.0", 16) ||
    inRange("127.0.0.0", 8) ||
    inRange("169.254.0.0", 16) || // link-local incl. cloud metadata
    inRange("100.64.0.0", 10) || // carrier-grade NAT
    inRange("0.0.0.0", 8)
  );
}

function isPrivateIpv6(host: string): boolean {
  const h = host.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
  if (h === "::1" || h === "::") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // fc00::/7 unique local
  if (h.startsWith("fe8") || h.startsWith("fe9") || h.startsWith("fea") || h.startsWith("feb"))
    return true; // fe80::/10 link-local
  return false;
}

/**
 * Validate a user-supplied MCP server URL.
 * @param allowLoopback allow http:// + loopback (development only).
 */
export function checkMcpServerUrl(input: string, allowLoopback = false): UrlCheckResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: true, normalized: "" }; // optional field

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: "Not a valid URL." };
  }

  const scheme = url.protocol.replace(":", "").toLowerCase();
  const hostname = url.hostname.toLowerCase();
  const isLoopback =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]";

  if (scheme !== "https" && scheme !== "http") {
    return { ok: false, reason: `Scheme "${scheme}" is not allowed. Use https://.` };
  }
  if (scheme === "http" && !(allowLoopback && isLoopback)) {
    return { ok: false, reason: "Use https:// (http:// is only allowed for loopback in development)." };
  }

  if (allowLoopback && isLoopback) {
    return { ok: true, normalized: url.toString() };
  }

  if (BLOCKED_HOSTNAMES.has(hostname) || BLOCKED_EXACT_IPS.has(hostname)) {
    return { ok: false, reason: "Host targets a blocked internal/metadata address." };
  }

  // IPv4 literal
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    if (isPrivateIpv4(hostname)) {
      return { ok: false, reason: "Host targets a private, loopback, or metadata IP range." };
    }
  }

  // IPv6 literal
  if (hostname.includes(":") || url.hostname.startsWith("[")) {
    if (isPrivateIpv6(url.hostname)) {
      return { ok: false, reason: "Host targets a private or link-local IPv6 range." };
    }
  }

  return { ok: true, normalized: url.toString() };
}
