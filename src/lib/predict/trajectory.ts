import { dedupeSnapshots, type FollowerSnapshotRow } from "@/lib/kpis/aggregate";
import { blendedDailyRate } from "./rate";
import { Trajectory } from "./schemas";

const DAY = 86_400_000;
const utc = (date: string) => Date.parse(`${date}T00:00:00Z`);
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Historical follower series (solid) + a horizonDays projection (dashed) using the
 * same blendedDailyRate as weeklyForecast (snapshot fit, or analytics_daily fallback
 * when sparse). projected starts the day AFTER the last actual so the dashed segment
 * connects cleanly. Null when no anchor snapshot or no rate.
 */
export function projectTrajectory(
  rows: FollowerSnapshotRow[],
  horizonDays: number,
  _now: number = Date.now(),
  fallbackDailyRate: number | null = null,
): Trajectory | null {
  const snaps = dedupeSnapshots(rows);
  if (snaps.length === 0) return null;
  const rf = blendedDailyRate(snaps, fallbackDailyRate);
  if (!rf) return null;

  const last = snaps[snaps.length - 1];
  const lastMs = utc(last.snapshot_date);
  const projected = Array.from({ length: horizonDays }, (_, i) => ({
    date: isoDay(lastMs + (i + 1) * DAY),
    followers: Math.round(last.followers + rf.dailyRate * (i + 1)),
  }));

  return Trajectory.parse({
    history: snaps.map((s) => ({ date: s.snapshot_date, followers: s.followers })),
    projected,
    dailyRate: rf.dailyRate,
    r2: rf.r2,
    horizonDays,
  });
}
