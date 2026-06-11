import type { KpiSummary } from "./schemas";

export type RateBand = NonNullable<KpiSummary["followRateBand"]>;

export function formatRate(rate: number | null | undefined): string {
  if (rate == null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

export function formatPerDay(v: number | null | undefined): string {
  if (v == null) return "—";
  return v >= 10 ? String(Math.round(v)) : v.toFixed(1);
}

export function formatDelta(d: number | null | undefined): string {
  if (d == null) return "—";
  return d >= 0 ? `+${d}` : String(d);
}

const BAND_CHIPS: Record<RateBand, { text: string; className: string }> = {
  good: { text: "3–8% healthy", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
  low: { text: "below 3% — sharpen hooks", className: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  high: { text: "above 8% — exceptional", className: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
};

/** Chip styling mirrors the topic-card pill idiom (paired light/dark classes). */
export function bandChip(band: RateBand | null | undefined): { text: string; className: string } | null {
  if (band == null) return null;
  return BAND_CHIPS[band];
}
