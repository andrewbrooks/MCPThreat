import { describe, expect, it } from "vitest";
import { checkMcpServerUrl } from "@/lib/url-safety";

// SSRF guard: the product validates user-supplied MCP server URLs. These are the
// cases that must never pass, plus the legitimate ones that must.
describe("checkMcpServerUrl", () => {
  it("accepts a normal https URL", () => {
    expect(checkMcpServerUrl("https://mcp.example.com/path").ok).toBe(true);
  });

  it("treats an empty value as an allowed (optional) field", () => {
    expect(checkMcpServerUrl("").ok).toBe(true);
  });

  it("rejects non-http(s) schemes", () => {
    expect(checkMcpServerUrl("ftp://example.com").ok).toBe(false);
    expect(checkMcpServerUrl("file:///etc/passwd").ok).toBe(false);
    expect(checkMcpServerUrl("gopher://example.com").ok).toBe(false);
  });

  it("rejects plain http for non-loopback hosts", () => {
    expect(checkMcpServerUrl("http://example.com").ok).toBe(false);
  });

  it("blocks the cloud metadata endpoint", () => {
    expect(checkMcpServerUrl("https://169.254.169.254/latest/meta-data").ok).toBe(false);
    expect(checkMcpServerUrl("https://metadata.google.internal/").ok).toBe(false);
  });

  it("blocks private and loopback IPv4 ranges", () => {
    for (const host of ["10.0.0.5", "172.16.0.1", "192.168.1.1", "127.0.0.1"]) {
      expect(checkMcpServerUrl(`https://${host}/`).ok, host).toBe(false);
    }
  });

  it("blocks private and link-local IPv6 ranges", () => {
    expect(checkMcpServerUrl("https://[::1]/").ok).toBe(false);
    expect(checkMcpServerUrl("https://[fd00::1]/").ok).toBe(false);
    expect(checkMcpServerUrl("https://[fe80::1]/").ok).toBe(false);
  });

  it("rejects malformed URLs", () => {
    expect(checkMcpServerUrl("not a url").ok).toBe(false);
  });

  it("allows http loopback only when explicitly permitted (dev)", () => {
    expect(checkMcpServerUrl("http://localhost:3000", false).ok).toBe(false);
    expect(checkMcpServerUrl("http://localhost:3000", true).ok).toBe(true);
    expect(checkMcpServerUrl("http://127.0.0.1:8080", true).ok).toBe(true);
  });
});
