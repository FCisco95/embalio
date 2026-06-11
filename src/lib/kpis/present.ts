import type { KpiSummary } from "./schemas";

export type RateBand = NonNullable<KpiSummary["followRateBand"]>;

export function formatRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

export function formatPerDay(v: number | null): string {
  if (v === null) return "—";
  return v >= 10 ? String(Math.round(v)) : v.toFixed(1);
}

export function formatDelta(d: number | null): string {
  if (d === null) return "—";
  return d >= 0 ? `+${d}` : String(d);
}

/** Chip styling mirrors the topic-card pill idiom (paired light/dark classes). */
export function bandChip(band: RateBand | null): { text: string; className: string } | null {
  if (band === "good")
    return { text: "3–8% healthy", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" };
  if (band === "low")
    return { text: "below 3% — sharpen hooks", className: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" };
  if (band === "high")
    return { text: "above 8% — exceptional", className: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" };
  return null;
}
