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

function serializeMeta(meta?: LogMeta): LogMeta | undefined {
  if (!meta) return undefined;

  const output: LogMeta = {};

  for (const [key, value] of Object.entries(meta)) {
    if (value == null) continue;

    if (value instanceof Error) {
      output[key] = {
        name: value.name,
        message: value.message,
        stack: value.stack
      };
      continue;
    }

    output[key] = typeof value === "bigint" ? value.toString() : value;
  }

  return Object.keys(output).length > 0 ? output : undefined;
}

function shouldLog(level: LogLevel): boolean {
  return levelOrder[level] >= levelOrder[configuredLevel];
}

function formatMetaValue(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return String(value);
  }

  return JSON.stringify(value);
}

function formatPrettyLine(
  level: LogLevel,
  scope: string,
  message: string,
  meta?: LogMeta
): string {
  const ts = new Date().toISOString();
  const levelLabel = level.toUpperCase().padEnd(5, " ");
  const base = `${ts} ${levelLabel} [${scope}] ${message}`;
  const serializedMeta = serializeMeta(meta);

  if (!serializedMeta) return base;

  const parts: string[] = [];
  let errorStack: string | null = null;

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

      parts.push(
        `${key}=${JSON.stringify(`${errorName}: ${(value as { message: string }).message}`)}`
      );

      if (
        "stack" in value &&
        typeof (value as { stack?: unknown }).stack === "string"
      ) {
        errorStack = (value as { stack: string }).stack;
      }

      continue;
    }

    parts.push(`${key}=${formatMetaValue(value)}`);
  }

  if (!errorStack) return `${base} | ${parts.join(" ")}`;

  return `${base} | ${parts.join(" ")}\n${errorStack}`;
}

function writeLog(
  level: LogLevel,
  scope: string,
  message: string,
  meta?: LogMeta
): void {
  if (!shouldLog(level)) return;

  const serializedMeta = serializeMeta(meta);
  const line =
    process.env.LOG_PRETTY !== "false"
      ? formatPrettyLine(level, scope, message, meta)
      : JSON.stringify({
          ts: new Date().toISOString(),
          level,
          scope,
          msg: message,
          ...(serializedMeta ?? {})
        });

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
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
