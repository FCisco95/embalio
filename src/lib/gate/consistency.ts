/** Judged day 30: at least this many of the 30 days need a published post. */
export const CONSISTENCY_TARGET_DAYS = 21;

export interface ConsistencyDay {
  /** UTC calendar day, YYYY-MM-DD. */
  date: string;
  posts: number;
}

export interface ConsistencyResult {
  days: number;
  /** Days in the window with at least one published post. */
  publishDays: number;
  target: typeof CONSISTENCY_TARGET_DAYS;
  passed: boolean;
  /** One entry per day, oldest first, ending on `now`'s UTC day. */
  perDay: ConsistencyDay[];
}

const DAY_MS = 86_400_000;

function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * The consistency gate: how many of the last `days` UTC days carry at least one
 * published post (`posts.posted_at`). Timestamps outside the window (older, or
 * in the future) and unparseable ones are ignored.
 */
export function computeConsistency(postedAts: string[], now: Date, days = 30): ConsistencyResult {
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const perDay: ConsistencyDay[] = Array.from({ length: days }, (_, i) => ({
    date: utcDay(todayStart - (days - 1 - i) * DAY_MS),
    posts: 0,
  }));
  const index = new Map(perDay.map((d, i) => [d.date, i]));

  for (const iso of postedAts) {
    const t = Date.parse(iso);
    if (Number.isNaN(t)) continue;
    const i = index.get(utcDay(t));
    if (i !== undefined) perDay[i].posts += 1;
  }

  const publishDays = perDay.filter((d) => d.posts > 0).length;
  return {
    days,
    publishDays,
    target: CONSISTENCY_TARGET_DAYS,
    passed: publishDays >= CONSISTENCY_TARGET_DAYS,
    perDay,
  };
}
