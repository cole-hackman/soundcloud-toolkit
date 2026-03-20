export function formatDuration(ms?: number | null): string {
  if (typeof ms !== "number" || Number.isNaN(ms) || ms < 0) return "-";
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatCompactNumber(value?: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

export function formatDate(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString();
}

export function parseTagList(tagList?: string | null): string[] {
  if (!tagList) return [];
  const quoted = [...tagList.matchAll(/"([^"]+)"/g)].map((m) => m[1].trim()).filter(Boolean);
  if (quoted.length > 0) return quoted;
  return tagList.split(/\s+/).map((t) => t.trim()).filter(Boolean);
}
