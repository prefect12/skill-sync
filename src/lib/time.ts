export function formatTimestamp(value?: number): string {
  if (!value || Number.isNaN(value)) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}
