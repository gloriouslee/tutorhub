type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

const REDACTED_KEYS = new Set([
  "password",
  "new_password",
  "current_password",
  "authorization",
  "cookie",
  "token",
  "service_role_key",
]);

function redact(value: unknown, key?: string): unknown {
  if (key && REDACTED_KEYS.has(key.toLowerCase())) return "[REDACTED]";
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redact(entryValue, entryKey),
      ]),
    );
  }
  return value;
}

export function logEvent(
  level: LogLevel,
  event: string,
  context: LogContext = {},
) {
  const redactedContext = redact(context) as LogContext;
  const record = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...redactedContext,
  });

  if (level === "error") console.error(record);
  else if (level === "warn") console.warn(record);
  else if (level === "debug") console.debug(record);
  else console.info(record);
}
