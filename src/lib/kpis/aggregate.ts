import { KpiSummary } from "./schemas";

const DAY = 86_400_000;

export interface AnalyticsDayRow {
  date: string; // YYYY-MM-DD
  profile_visits: number;
  new_follows: number;
  imported_at?: string | null;
}

export interface FollowerSnapshotRow {
  snapshot_date: string; // YYYY-MM-DD
  followers: number;
  captured_at?: string | null;
}

export interface FollowerStat {
  followers: number;
  delta7d: number | null;
  series: { date: string; followers: number }[];
}

const utc = (date: string) => Date.parse(`${date}T00:00:00Z`);

/** North-star band: follows ÷ profile visits, 3–8% = healthy. */
export function followRateBand(rate: number): "low" | "good" | "high" {
  if (rate < 0.03) return "low";
  if (rate <= 0.08) return "good";
  return "high";
}

/** One snapshot per day — (date,source) duplicates resolve to the newest captured_at. */
export function dedupeSnapshots(rows: FollowerSnapshotRow[]): FollowerSnapshotRow[] {
  const byDate = new Map<string, FollowerSnapshotRow>();
  for (const r of rows) {
    const prev = byDate.get(r.snapshot_date);
    if (!prev || (r.captured_at ?? "") > (prev.captured_at ?? "")) byDate.set(r.snapshot_date, r);
  }
  return [...byDate.values()].sort((a, b) => utc(a.snapshot_date) - utc(b.snapshot_date));
}

/** Current followers + 7d delta + ≤14-point series. Null when no snapshots. */
export function computeFollowerStat(rows: FollowerSnapshotRow[]): FollowerStat | null {
  const snaps = dedupeSnapshots(rows);
  if (snaps.length === 0) return null;
  const latest = snaps[snaps.length - 1];
  const target = utc(latest.snapshot_date) - 7 * DAY;
  const baseline = [...snaps].reverse().find((s) => utc(s.snapshot_date) <= target) ?? null;
  return {
    followers: latest.followers,
    delta7d: baseline ? latest.followers - baseline.followers : null,
    series: snaps.slice(-14).map((s) => ({ date: s.snapshot_date, followers: s.followers })),
  };
}

/**
 * Pure KPI aggregator. The 7d window anchors to the newest imported day
 * (dataThrough), NOT to `now` — the CSV is weekly and always lags; staleness
 * is its own signal (staleDays). Per-day averages divide by days WITH data so
 * a partial week isn't understated. Nulls mean "no data", never 0.
 */
export function computeKpis(input: {
  analytics: AnalyticsDayRow[];
  snapshots: FollowerSnapshotRow[];
  now?: number;
}): KpiSummary {
  const { analytics, snapshots, now = Date.now() } = input;
  const days = [...analytics].sort((a, b) => utc(a.date) - utc(b.date));
  const dataThrough = days.length > 0 ? days[days.length - 1].date : null;

  let followsPerDay7d: number | null = null;
  let visitsPerDay7d: number | null = null;
  let followRate7d: number | null = null;
  if (dataThrough) {
    const from = utc(dataThrough) - 6 * DAY;
    const win = days.filter((d) => utc(d.date) >= from);
    const visits = win.reduce((s, d) => s + d.profile_visits, 0);
    const follows = win.reduce((s, d) => s + d.new_follows, 0);
    visitsPerDay7d = visits / win.length;
    followsPerDay7d = follows / win.length;
    followRate7d = visits > 0 ? follows / visits : null;
  }

  const recent = days.slice(-14);
  const stat = computeFollowerStat(snapshots);
  const lastImportAt = days.reduce<string | null>(
    (max, d) => (d.imported_at && (!max || d.imported_at > max) ? d.imported_at : max),
    null,
  );

  return KpiSummary.parse({
    followsPerDay7d,
    visitsPerDay7d,
    followRate7d,
    followRateBand: followRate7d === null ? null : followRateBand(followRate7d),
    followerCount: stat?.followers ?? null,
    followerDelta7d: stat?.delta7d ?? null,
    followerSeries: stat?.series ?? [],
    visitsSeries: recent.map((d) => ({ date: d.date, value: d.profile_visits })),
    followsSeries: recent.map((d) => ({ date: d.date, value: d.new_follows })),
    rateSeries: recent.map((d) => ({
      date: d.date,
      value: d.profile_visits > 0 ? d.new_follows / d.profile_visits : 0,
    })),
    dataThrough,
    lastImportAt,
    staleDays: dataThrough ? Math.max(0, Math.floor((now - utc(dataThrough)) / DAY)) : null,
  });
}
