export function formatNumber(value: number) {
  return value.toLocaleString("en-US");
}

export function formatCountLabel(
  count: number,
  singular: string,
  plural = `${singular}s`
) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function capitalizeFirst(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatRunTime(ms: number) {
  const minutes = Math.floor(ms / 60_000)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor((ms % 60_000) / 1_000)
    .toString()
    .padStart(2, "0");
  const centiseconds = Math.floor((ms % 1_000) / 10)
    .toString()
    .padStart(2, "0");

  return `${minutes}'${seconds}"${centiseconds}`;
}

export function formatFullDateTime(timestampMs: number) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone
  }).format(timestampMs);
}
