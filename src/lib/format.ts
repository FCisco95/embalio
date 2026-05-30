/** Compact number formatting for metric displays (e.g. 312400 → "312.4K"). */
export function formatCount(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + "M"
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + "K"
  return String(n)
}
