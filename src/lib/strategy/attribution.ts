import { ReplyFollowAttribution } from "./schemas";

export interface DailyPair { replies: number; followerDelta: number; }

/** Pearson correlation of two series; 0 for degenerate (zero-variance) input. */
export function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n === 0) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { const a = xs[i] - mx, b = ys[i] - my; num += a * b; dx += a * a; dy += b * b; }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

const DISCLAIMER =
  "Correlation only — this is not proof that replies drive follows. Many factors move follower counts.";

/** Correlate daily reply counts with daily follower deltas. n-guard ≥ minN; never causal. */
export function replyFollowAttribution(pairs: DailyPair[], minN = 20): ReplyFollowAttribution {
  const n = pairs.length;
  if (n < minN) {
    return ReplyFollowAttribution.parse({
      status: "insufficient_data", n, minN,
      message: `Need ≥${minN} paired days; have ${n}. Keep replying — attribution unlocks at ${minN}.`,
    });
  }
  const r = pearson(pairs.map((p) => p.replies), pairs.map((p) => p.followerDelta));
  return ReplyFollowAttribution.parse({ status: "correlation", n, r, label: "correlation", disclaimer: DISCLAIMER });
}

export interface ReplyEventRow { created_at: string; }
export interface FollowerSnapRow { snapshot_date: string; captured_at: string; followers: number; }

/**
 * Build daily (replies, followerDelta) pairs for attribution. Collapses multi-source
 * follower rows to ONE per snapshot_date (latest captured_at wins) BEFORE diffing — the
 * follower_snapshots unique key is (profile_id, snapshot_date, source), so a csv + scrape
 * on the same day would otherwise inject a spurious zero-elapsed-day delta. Pure.
 */
export function buildReplyFollowPairs(replyEvents: ReplyEventRow[], snaps: FollowerSnapRow[]): DailyPair[] {
  const repliesByDay = new Map<string, number>();
  for (const e of replyEvents) {
    const day = e.created_at.slice(0, 10);
    repliesByDay.set(day, (repliesByDay.get(day) ?? 0) + 1);
  }
  const byDay = new Map<string, FollowerSnapRow>();
  for (const s of snaps) {
    const prev = byDay.get(s.snapshot_date);
    if (!prev || s.captured_at > prev.captured_at) byDay.set(s.snapshot_date, s);
  }
  const days = [...byDay.keys()].sort();
  const out: DailyPair[] = [];
  for (let i = 1; i < days.length; i++) {
    const cur = byDay.get(days[i])!;
    const prev = byDay.get(days[i - 1])!;
    out.push({ replies: repliesByDay.get(days[i]) ?? 0, followerDelta: cur.followers - prev.followers });
  }
  return out;
}
