/** Formatting helpers for the GATE-2 scorecard UI. Null → "—" (insufficient data). */

export function pct(x: number | null): string {
  return x === null ? "—" : `${Math.round(x * 100)}%`;
}

export function signedPct(x: number | null): string {
  if (x === null) return "—";
  const v = Math.round(x * 100);
  return v >= 0 ? `+${v}%` : `${v}%`;
}

export function passChip(ok: boolean): { text: string; className: string } {
  return ok
    ? { text: "PASS", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" }
    : { text: "not yet", className: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" };
}
