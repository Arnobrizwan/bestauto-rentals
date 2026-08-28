type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN = LEVELS[(process.env.LOG_LEVEL as Level) ?? (process.env.NODE_ENV === "production" ? "info" : "debug")];

const REDACT = /(api[-_]?key|authorization|password|token|secret)/i;

/** Strips anything that looks like a credential before it reaches a log sink. */
function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, REDACT.test(k) ? "[redacted]" : redact(v)]),
    );
  }
  if (typeof value === "string" && value.length > 400) return `${value.slice(0, 400)}...`;
  return value;
}

function write(level: Level, event: string, data?: Record<string, unknown>) {
  if (LEVELS[level] < MIN) return;
  const line = { level, event, ts: new Date().toISOString(), ...(data ? (redact(data) as object) : {}) };
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  sink(JSON.stringify(line));
}

export const log = {
  debug: (event: string, data?: Record<string, unknown>) => write("debug", event, data),
  info: (event: string, data?: Record<string, unknown>) => write("info", event, data),
  warn: (event: string, data?: Record<string, unknown>) => write("warn", event, data),
  error: (event: string, data?: Record<string, unknown>) => write("error", event, data),
};

/** Times an async operation and emits one structured line with the outcome. */
export async function traced<T>(event: string, fn: () => Promise<T>, meta: Record<string, unknown> = {}): Promise<T> {
  const started = Date.now();
  try {
    const result = await fn();
    log.info(event, { ...meta, ok: true, durationMs: Date.now() - started });
    return result;
  } catch (err) {
    log.error(event, {
      ...meta,
      ok: false,
      durationMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
