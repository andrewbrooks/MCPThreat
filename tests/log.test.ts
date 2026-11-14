import { describe, expect, it } from "vitest";
import { createLogger, formatLog, redact } from "@/lib/log";

const parse = (line: string) => JSON.parse(line) as Record<string, unknown>;
const T = new Date("2026-01-02T03:04:05.000Z");

describe("redact", () => {
  it("replaces values whose key looks sensitive, at any depth", () => {
    const out = redact({
      user: "ann",
      password: "hunter2",
      nested: { apiKey: "k", Authorization: "x", cookie: "c", client_secret: "s", token: "t" },
    }) as Record<string, Record<string, unknown>>;
    expect(out.user).toBe("ann");
    expect(out.password).toBe("[redacted]");
    expect(Object.values(out.nested)).toEqual(Array(5).fill("[redacted]"));
  });

  it("scrubs token-shaped strings inside values", () => {
    const out = redact({ note: "failed with Bearer abc.def-123456 and sk-ant-api03-ABCDEFGH1234" }) as {
      note: string;
    };
    expect(out.note).not.toMatch(/abc\.def|sk-ant-api03/);
    expect(out.note).toContain("[redacted]");
    expect(redact("ghp_" + "a".repeat(30))).toBe("[redacted]");
  });

  it("truncates long strings and limits depth", () => {
    expect((redact("x".repeat(2000)) as string).length).toBeLessThan(600);
    expect(JSON.stringify(redact({ a: { b: { c: { d: { e: 1 } } } } }))).toContain("[truncated]");
  });

  it("survives circular references", () => {
    const a: Record<string, unknown> = { name: "a" };
    a.self = a;
    expect((redact(a) as Record<string, unknown>).self).toBe("[circular]");
  });

  it("serialises errors without leaking secrets in the message", () => {
    const out = redact(new Error("call failed: Bearer secretvalue12345")) as { name: string; message: string };
    expect(out.name).toBe("Error");
    expect(out.message).not.toContain("secretvalue12345");
  });
});

describe("formatLog", () => {
  it("writes one JSON object with time, level and msg", () => {
    expect(parse(formatLog("warn", "disk low", { free: 3 }, T))).toEqual({
      free: 3,
      time: "2026-01-02T03:04:05.000Z",
      level: "warn",
      msg: "disk low",
    });
  });

  it("does not let a field overwrite the reserved keys", () => {
    const line = parse(formatLog("info", "real", { level: "debug", msg: "fake", time: "never" }, T));
    expect(line.level).toBe("info");
    expect(line.msg).toBe("real");
    expect(line.time).toBe("2026-01-02T03:04:05.000Z");
  });
});

describe("createLogger", () => {
  const capture = (threshold: Parameters<typeof createLogger>[0]) => {
    const lines: [string, string][] = [];
    return { lines, logger: createLogger(threshold, (l, line) => lines.push([l, line])) };
  };

  it("drops messages below the threshold", () => {
    const { lines, logger } = capture("warn");
    logger.debug("a");
    logger.info("b");
    logger.warn("c");
    logger.error("d");
    expect(lines.map(([l]) => l)).toEqual(["warn", "error"]);
  });

  it("silent writes nothing", () => {
    const { lines, logger } = capture("silent");
    logger.error("nope");
    expect(lines).toHaveLength(0);
  });

  it("redacts what it is given", () => {
    const { lines, logger } = capture("debug");
    logger.error("login failed", { password: "p", email: "a@b.co" });
    const out = parse(lines[0][1]);
    expect(out.password).toBe("[redacted]");
    expect(out.email).toBe("a@b.co");
  });
});
