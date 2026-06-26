/**
 * GATE-2 dogfood scorecard — pure derivation, no I/O.
 *
 * Turns recorded sniper-alert decisions + daily profile-visit data into the
 * metrics the self-dogfood is judged on. Manual-entry inputs only (no X scrape).
 * Every ratio is null-guarded: insufficient data → null, never NaN — the UI
 * renders "—" / insufficient-n rather than a fake number. NO scoring
 * sophistication, NO ML — this only counts and averages what the owner recorded.
 */

export const SKIP_REASONS = ["off_niche", "stale", "bait", "wrong_size", "other"] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];

/** DoD thresholds (handoff): precision ≥70%, ≥3 cleared-2× replies, ≥+25% reply-day visit lift. */
export const GATE_THRESHOLDS = { precision: 0.7, cleared2x: 3, visitLift: 0.25 } as const;

export interface ScorecardAlert {
  status: "sent" | "acted" | "dismissed";
  skip_reason: string | null;
  reply_impressions: number | null;
  author_median_reply_impressions: number | null;
  author_reply_back: boolean | null;
  /** ISO timestamp of the manual send; its UTC date is the reply-day anchor. */
  sent_at: string | null;
}

export interface VisitDay {
  /** YYYY-MM-DD (UTC), matching analytics_daily.date. */
  date: string;
  profile_visits: number;
}

export interface GateScorecard {
  acted: number;
  dismissed: number;
  decided: number;
  /** acted / decided — sniper precision. */
  precision: number | null;
  /** dismissed / decided. */
  falseAlertRate: number | null;
  skipBreakdown: Record<SkipReason, number>;
  /** author replied back / acted alerts whose outcome was recorded. */
  authorReplyBackRate: number | null;
  authorReplyBackN: number;
  /** acted replies clearing ≥2× the author's median reply impressions. */
  cleared2xCount: number;
  cleared2xN: number;
  replyDays: number;
  replyDayAvgVisits: number | null;
  baselineAvgVisits: number | null;
  /** (reply-day avg visits − baseline avg) / baseline avg — the reach signal. */
  replyDayVisitLift: number | null;
  thresholds: typeof GATE_THRESHOLDS;
  pass: { precision: boolean; cleared2x: boolean; visitLift: boolean; overall: boolean };
}

function avg(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

export function computeScorecard(alerts: ScorecardAlert[], visitDays: VisitDay[]): GateScorecard {
  const acted = alerts.filter((a) => a.status === "acted");
  const dismissed = alerts.filter((a) => a.status === "dismissed");
  const decided = acted.length + dismissed.length;

  const skipBreakdown = Object.fromEntries(SKIP_REASONS.map((r) => [r, 0])) as Record<SkipReason, number>;
  for (const d of dismissed) {
    if (d.skip_reason && (SKIP_REASONS as readonly string[]).includes(d.skip_reason)) {
      skipBreakdown[d.skip_reason as SkipReason] += 1;
    }
  }

  const replyBackKnown = acted.filter((a) => a.author_reply_back !== null);
  const replyBackYes = replyBackKnown.filter((a) => a.author_reply_back === true).length;

  const cleared2xEligible = acted.filter(
    (a) =>
      a.reply_impressions !== null &&
      a.author_median_reply_impressions !== null &&
      a.author_median_reply_impressions > 0,
  );
  const cleared2xCount = cleared2xEligible.filter(
    (a) => (a.reply_impressions as number) >= 2 * (a.author_median_reply_impressions as number),
  ).length;

  const replyDaySet = new Set(
    acted
      .map((a) => a.sent_at)
      .filter((s): s is string => !!s)
      .map((s) => s.slice(0, 10)),
  );
  const replyDayAvgVisits = avg(visitDays.filter((v) => replyDaySet.has(v.date)).map((v) => v.profile_visits));
  const baselineAvgVisits = avg(visitDays.filter((v) => !replyDaySet.has(v.date)).map((v) => v.profile_visits));
  const replyDayVisitLift =
    replyDayAvgVisits !== null && baselineAvgVisits !== null && baselineAvgVisits > 0
      ? (replyDayAvgVisits - baselineAvgVisits) / baselineAvgVisits
      : null;

  const precision = decided ? acted.length / decided : null;
  const falseAlertRate = decided ? dismissed.length / decided : null;
  const authorReplyBackRate = replyBackKnown.length ? replyBackYes / replyBackKnown.length : null;

  const pass = {
    precision: precision !== null && precision >= GATE_THRESHOLDS.precision,
    cleared2x: cleared2xCount >= GATE_THRESHOLDS.cleared2x,
    visitLift: replyDayVisitLift !== null && replyDayVisitLift >= GATE_THRESHOLDS.visitLift,
    overall: false,
  };
  pass.overall = pass.precision && pass.cleared2x && pass.visitLift;

  return {
    acted: acted.length,
    dismissed: dismissed.length,
    decided,
    precision,
    falseAlertRate,
    skipBreakdown,
    authorReplyBackRate,
    authorReplyBackN: replyBackKnown.length,
    cleared2xCount,
    cleared2xN: cleared2xEligible.length,
    replyDays: replyDaySet.size,
    replyDayAvgVisits,
    baselineAvgVisits,
    replyDayVisitLift,
    thresholds: GATE_THRESHOLDS,
    pass,
  };
}
