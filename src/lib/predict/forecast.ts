import { dedupeSnapshots, type FollowerSnapshotRow } from "@/lib/kpis/aggregate";
import { blendedDailyRate } from "./rate";
import { WeeklyForecast } from "./schemas";

const DAY = 86_400_000;
const utc = (date: string) => Date.parse(`${date}T00:00:00Z`);

/** YYYY-MM-DD of the upcoming Sunday (UTC). Sunday itself rolls to next Sunday. */
export function endOfWeekUTC(now: number): string {
  const d = new Date(now);
  const dow = d.getUTCDay();               // 0=Sun
  const add = dow === 0 ? 7 : 7 - dow;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + add)).toISOString().slice(0, 10);
}

/**
 * End-of-week follower prediction. Rate = blendedDailyRate (OLS slope + EMA of
 * day-over-day deltas, or the analytics_daily fallback when snapshots are sparse).
 * Null when no anchor snapshot or no rate. Band = ±1σ of fit residuals (0 on fallback).
 */
export function weeklyForecast(
  rows: FollowerSnapshotRow[],
  now: number = Date.now(),
  fallbackDailyRate: number | null = null,
): WeeklyForecast | null {
  const snaps = dedupeSnapshots(rows);
  if (snaps.length === 0) return null;
  const rf = blendedDailyRate(snaps, fallbackDailyRate);
  if (!rf) return null;

  const latest = snaps[snaps.length - 1];
  const targetDate = endOfWeekUTC(now);
  const daysAhead = Math.max(0, Math.round((utc(targetDate) - utc(latest.snapshot_date)) / DAY));
  const predicted = latest.followers + rf.dailyRate * daysAhead;

  return WeeklyForecast.parse({
    currentFollowers: latest.followers,
    predictedFollowers: Math.round(predicted),
    predictedDate: targetDate,
    dailyRate: rf.dailyRate,
    low: Math.round(predicted - rf.sigma),
    high: Math.round(predicted + rf.sigma),
    r2: rf.r2,
    basisDays: snaps.length,
  });
}
