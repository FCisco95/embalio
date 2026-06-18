import { type FollowerSnapshotRow } from "@/lib/kpis/aggregate";
import { linearRegression, ema } from "./regression";

const DAY = 86_400_000;
const utc = (date: string) => Date.parse(`${date}T00:00:00Z`);

export interface RateFit {
  dailyRate: number;
  r2: number;
  sigma: number;
}

/**
 * Blended daily follower-growth rate from a follower-snapshot series. snaps must be
 * deduped + sorted ascending.
 * - >=2 snapshots: (OLS slope + EMA of daily deltas) / 2, with fit r2 + residual sigma.
 * - <2 snapshots: falls back to fallbackDailyRate (e.g. avg new_follows/day from
 *   analytics_daily); r2 + sigma are 0 (no fit, no band).
 * - null when neither path yields a rate.
 */
export function blendedDailyRate(snaps: FollowerSnapshotRow[], fallbackDailyRate: number | null = null): RateFit | null {
  if (snaps.length >= 2) {
    const d0 = utc(snaps[0].snapshot_date);
    const points = snaps.map((s) => ({ x: (utc(s.snapshot_date) - d0) / DAY, y: s.followers }));
    const fit = linearRegression(points);
    const deltas = snaps.slice(1).map((s, i) => s.followers - snaps[i].followers);
    const dailyRate = (fit.slope + ema(deltas, 0.5)) / 2;
    const resid = points.map((p) => p.y - (fit.slope * p.x + fit.intercept));
    const sigma = Math.sqrt(resid.reduce((s, e) => s + e * e, 0) / resid.length);
    return { dailyRate, r2: fit.r2, sigma };
  }
  if (fallbackDailyRate !== null) return { dailyRate: fallbackDailyRate, r2: 0, sigma: 0 };
  return null;
}

/** Avg new_follows/day from analytics_daily rows — the sparse-data fallback rate. Null when empty. */
export function avgDailyFollowsPerDay(rows: { new_follows: number }[]): number | null {
  if (rows.length === 0) return null;
  return rows.reduce((s, r) => s + r.new_follows, 0) / rows.length;
}
