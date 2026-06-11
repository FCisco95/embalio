/** Relative "updated Xm ago" stamp. Returns null for unparseable input — and a
 * null stamp means the card must NOT render (spec freshness QA rule #1). */
export function formatAgo(iso: string, nowMs: number = Date.now()): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const mins = Math.floor((nowMs - t) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
