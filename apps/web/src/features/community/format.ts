/** Small formatting helpers shared by the forum, Plaza and resources pages. */

export function parseTags(raw: string): string[] {
  const tags = raw
    .split(",")
    .map((t) => t.trim().toLowerCase().replace(/^#/, "").replace(/\s+/g, "-").slice(0, 30))
    .filter(Boolean);
  return [...new Set(tags)].slice(0, 5);
}

export function relative(iso: string, now = Date.now()): string {
  const s = Math.round((now - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
