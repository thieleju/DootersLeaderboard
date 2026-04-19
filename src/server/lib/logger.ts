type LogLevel = "debug" | "info" | "warn" | "error";

type LogMeta = Record<string, unknown>;

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function normalizeLevel(value: string | undefined): LogLevel {
  const normalized = value?.trim().toLowerCase();

  if (
    normalized === "debug" ||
    normalized === "info" ||
    normalized === "warn" ||
    normalized === "error"
  ) {
    return normalized;
  }

  return "debug";
}

const configuredLevel = normalizeLevel(process.env.LOG_LEVEL);

function normalizePrettyLogging(value: string | undefined): boolean {
  if (!value) {
    return process.env.NODE_ENV !== "production";
  }

  const normalized = value.trim().toLowerCase();
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "on"
  );
}

const usePrettyLogs = normalizePrettyLogging(process.env.LOG_PRETTY);

function serializeMeta(meta: LogMeta | undefined): LogMeta | undefined {
  if (!meta) return undefined;

  const output: LogMeta = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (value instanceof Error) {
      const errorEntry = {
        name: value.name,
        message: value.message,
        stack: value.stack
      };

      output[key] = Object.fromEntries(
        Object.entries(errorEntry).filter(([, part]) => part != null)
      );
      continue;
    }

    if (typeof value === "bigint") {
      output[key] = value.toString();
      continue;
    }

    output[key] = value;
  }

  return Object.keys(output).length > 0 ? output : undefined;
}

function shouldLog(level: LogLevel): boolean {
  return levelOrder[level] >= levelOrder[configuredLevel];
}

function formatMetaValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function formatPrettyLine(
  level: LogLevel,
  scope: string,
  message: string,
  meta?: LogMeta
) {
  const ts = new Date().toISOString();
  const levelLabel = level.toUpperCase().padEnd(5, " ");
  const base = `${ts} ${levelLabel} [${scope}] ${message}`;
  const serializedMeta = serializeMeta(meta);

  if (!serializedMeta || Object.keys(serializedMeta).length === 0) {
    return base;
  }

  const kvParts: string[] = [];
  let stack: string | null = null;

  for (const [key, value] of Object.entries(serializedMeta)) {
    if (
      key === "error" &&
      value &&
      typeof value === "object" &&
      "message" in value &&
      typeof (value as { message?: unknown }).message === "string"
    ) {
      const errorName =
        "name" in value &&
        typeof (value as { name?: unknown }).name === "string"
          ? (value as { name: string }).name
          : "Error";
      kvParts.push(
        `${key}=${JSON.stringify(`${errorName}: ${(value as { message: string }).message}`)}`
      );

      if (
        "stack" in value &&
        typeof (value as { stack?: unknown }).stack === "string"
      ) {
        stack = (value as { stack: string }).stack;
      }
      continue;
    }

    kvParts.push(`${key}=${formatMetaValue(value)}`);
  }

  if (stack) {
    return `${base} | ${kvParts.join(" ")}\n${stack}`;
  }

  return `${base} | ${kvParts.join(" ")}`;
}

function writeLog(
  level: LogLevel,
  scope: string,
  message: string,
  meta?: LogMeta
) {
  if (!shouldLog(level)) return;

  const line = usePrettyLogs
    ? formatPrettyLine(level, scope, message, meta)
    : JSON.stringify({
        ts: new Date().toISOString(),
        level,
        scope,
        msg: message,
        ...(serializeMeta(meta) ?? {})
      });

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export function createLogger(scope: string) {
  return {
    debug: (message: string, meta?: LogMeta) =>
      writeLog("debug", scope, message, meta),
    info: (message: string, meta?: LogMeta) =>
      writeLog("info", scope, message, meta),
    warn: (message: string, meta?: LogMeta) =>
      writeLog("warn", scope, message, meta),
    error: (message: string, meta?: LogMeta) =>
      writeLog("error", scope, message, meta)
  };
}
