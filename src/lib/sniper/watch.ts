export const MAX_ACTIVE_WATCH_TARGETS = 10; // spec: 5-10 priority handles; list size = paid-tier lever

/** "@LevelsIo" / "https://x.com/levelsio" / " levelsio " → "levelsio"; null if not a handle. */
export function normalizeWatchHandle(input: string): string | null {
  const h = input
    .trim()
    .replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "")
    .toLowerCase();
  return /^[a-z0-9_]{1,15}$/.test(h) ? h : null;
}
