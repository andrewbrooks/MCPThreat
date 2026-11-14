// Minimal structured logger. One JSON object per line with a level, so logs can be
// filtered and shipped. Safe to import from server and browser code (no Node APIs).
//
// Secrets are redacted before anything is written: fields whose names look sensitive
// are replaced, and token-shaped strings are scrubbed from values. Log what happened
// and which record it concerned; never log request bodies, credentials or tokens.

export type LogLevel = "debug" | "info" | "warn" | "error";
type Threshold = LogLevel | "silent";

const ORDER: Record<Threshold, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

const SENSITIVE_KEY =
  /pass(word)?|secret|token|authorization|cookie|api[-_]?key|credential|session/i;
const TOKEN_SHAPES: RegExp[] = [
  /Bearer\s+[A-Za-z0-9._~+/=-]{8,}/g,
  /sk-ant-[A-Za-z0-9_-]{8,}/g,
  /gh[pousr]_[A-Za-z0-9]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
];
const MAX_STRING = 500;
const MAX_DEPTH = 4;
const REDACTED = "[redacted]";

function scrub(text: string): string {
  let out = text;
  for (const shape of TOKEN_SHAPES) out = out.replace(shape, REDACTED);
  return out.length > MAX_STRING ? `${out.slice(0, MAX_STRING)}…` : out;
}

/** Copy of a value that is safe to log: secrets removed, long text cut, cycles broken. */
export function redact(value: unknown, depth = 0, seen: WeakSet<object> = new WeakSet()): unknown {
  if (typeof value === "string") return scrub(value);
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrub(value.message),
      stack: value.stack ? scrub(value.stack) : undefined,
    };
  }
  if (seen.has(value)) return "[circular]";
  if (depth >= MAX_DEPTH) return "[truncated]";
  seen.add(value);
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1, seen));
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(v, depth + 1, seen);
  }
  return out;
}

/** One log line as a JSON string. Pure, so it can be tested without any output. */
export function formatLog(
  level: LogLevel,
  msg: string,
  fields: Record<string, unknown> = {},
  now: Date = new Date(),
): string {
  const safe = redact(fields) as Record<string, unknown>;
  // Reserved keys always win over a caller's field of the same name.
  return JSON.stringify({ ...safe, time: now.toISOString(), level, msg: scrub(msg) });
}

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

/** A logger that drops entries below the threshold and passes each formatted line to write. Taking write as a parameter keeps it testable without capturing console output. */
export function createLogger(
  threshold: Threshold,
  write: (level: LogLevel, line: string) => void,
): Logger {
  const emit = (level: LogLevel, msg: string, fields?: Record<string, unknown>) => {
    if (ORDER[level] < ORDER[threshold]) return;
    write(level, formatLog(level, msg, fields));
  };
  return {
    debug: (m, f) => emit("debug", m, f),
    info: (m, f) => emit("info", m, f),
    warn: (m, f) => emit("warn", m, f),
    error: (m, f) => emit("error", m, f),
  };
}

function thresholdFromEnv(): Threshold {
  const raw = (typeof process !== "undefined" ? process.env.LOG_LEVEL : undefined)?.toLowerCase();
  if (raw && raw in ORDER) return raw as Threshold;
  // Keep test output quiet unless a test asks for logs.
  if (typeof process !== "undefined" && process.env.NODE_ENV === "test") return "silent";
  return "info";
}

/** The application logger. Set LOG_LEVEL to debug, info, warn, error or silent. */
export const log: Logger = createLogger(thresholdFromEnv(), (level, line) => {
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (level === "info") console.info(line);
  else console.debug(line);
});
