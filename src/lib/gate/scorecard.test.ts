import { describe, it, expect } from "vitest";
import { computeScorecard, type ScorecardAlert, type VisitDay } from "./scorecard";

const A = (o: Partial<ScorecardAlert> = {}): ScorecardAlert => ({
  status: "acted",
  skip_reason: null,
  reply_impressions: null,
  author_median_reply_impressions: null,
  author_reply_back: null,
  sent_at: null,
  ...o,
});

describe("computeScorecard", () => {
  it("empty input → all ratios null, zero counts, not passing", () => {
    const s = computeScorecard([], []);
    expect(s.acted).toBe(0);
    expect(s.dismissed).toBe(0);
    expect(s.precision).toBeNull();
    expect(s.falseAlertRate).toBeNull();
    expect(s.authorReplyBackRate).toBeNull();
    expect(s.cleared2xCount).toBe(0);
    expect(s.replyDayVisitLift).toBeNull();
    expect(s.pass.overall).toBe(false);
    expect(s.skipBreakdown).toEqual({ off_niche: 0, stale: 0, bait: 0, wrong_size: 0, other: 0 });
  });

  it("precision + false-alert rate from acted/dismissed split", () => {
    const alerts = [
      ...Array.from({ length: 7 }, () => A({ status: "acted" })),
      ...Array.from({ length: 3 }, () => A({ status: "dismissed" })),
    ];
    const s = computeScorecard(alerts, []);
    expect(s.precision).toBeCloseTo(0.7);
    expect(s.falseAlertRate).toBeCloseTo(0.3);
    expect(s.decided).toBe(10);
    expect(s.pass.precision).toBe(true);
  });

  it("skipBreakdown counts known reasons and ignores unknown ones", () => {
    const alerts = [
      A({ status: "dismissed", skip_reason: "off_niche" }),
      A({ status: "dismissed", skip_reason: "off_niche" }),
      A({ status: "dismissed", skip_reason: "bait" }),
      A({ status: "dismissed", skip_reason: "weird_value" }),
    ];
    const s = computeScorecard(alerts, []);
    expect(s.skipBreakdown.off_niche).toBe(2);
    expect(s.skipBreakdown.bait).toBe(1);
    expect(s.skipBreakdown.stale).toBe(0);
    // the unknown reason is not counted anywhere
    expect(Object.values(s.skipBreakdown).reduce((a, b) => a + b, 0)).toBe(3);
  });

  it("author-reply-back rate is over recorded outcomes only (null excluded)", () => {
    const alerts = [
      A({ author_reply_back: true }),
      A({ author_reply_back: true }),
      A({ author_reply_back: false }),
      A({ author_reply_back: null }), // not yet recorded → excluded from denominator
    ];
    const s = computeScorecard(alerts, []);
    expect(s.authorReplyBackN).toBe(3);
    expect(s.authorReplyBackRate).toBeCloseTo(2 / 3);
  });

  it("cleared-2x counts replies ≥2× a positive author median; excludes null/zero median", () => {
    const alerts = [
      A({ reply_impressions: 100, author_median_reply_impressions: 40 }), // 100 ≥ 80 ✓
      A({ reply_impressions: 50, author_median_reply_impressions: 30 }), //  50 < 60 ✗
      A({ reply_impressions: 100, author_median_reply_impressions: 0 }), //  median 0 → excluded
      A({ reply_impressions: 100, author_median_reply_impressions: null }), // median null → excluded
      A({ reply_impressions: null, author_median_reply_impressions: 40 }), // impressions null → excluded
    ];
    const s = computeScorecard(alerts, []);
    expect(s.cleared2xN).toBe(2); // only the two with both fields + positive median
    expect(s.cleared2xCount).toBe(1);
  });

  it("reply-day visit lift = (reply-day avg − baseline avg) / baseline avg", () => {
    const alerts = [
      A({ sent_at: "2026-06-10T12:00:00Z" }),
      A({ sent_at: "2026-06-12T09:30:00Z" }),
    ];
    const visits: VisitDay[] = [
      { date: "2026-06-10", profile_visits: 150 }, // reply day
      { date: "2026-06-11", profile_visits: 90 }, // baseline
      { date: "2026-06-12", profile_visits: 150 }, // reply day
      { date: "2026-06-13", profile_visits: 90 }, // baseline
    ];
    const s = computeScorecard(alerts, visits);
    expect(s.replyDays).toBe(2);
    expect(s.replyDayAvgVisits).toBe(150);
    expect(s.baselineAvgVisits).toBe(90);
    expect(s.replyDayVisitLift).toBeCloseTo((150 - 90) / 90);
    expect(s.pass.visitLift).toBe(true);
  });

  it("visit lift is null with no baseline days (cannot compute a lift)", () => {
    const alerts = [A({ sent_at: "2026-06-10T12:00:00Z" })];
    const visits: VisitDay[] = [{ date: "2026-06-10", profile_visits: 150 }]; // only a reply day
    const s = computeScorecard(alerts, visits);
    expect(s.baselineAvgVisits).toBeNull();
    expect(s.replyDayVisitLift).toBeNull();
    expect(s.pass.visitLift).toBe(false);
  });

  it("overall pass requires precision, cleared-2x, AND visit lift", () => {
    const acted = Array.from({ length: 4 }, () =>
      A({ reply_impressions: 100, author_median_reply_impressions: 40, sent_at: "2026-06-10T10:00:00Z" }),
    );
    const visits: VisitDay[] = [
      { date: "2026-06-10", profile_visits: 200 }, // reply day
      { date: "2026-06-11", profile_visits: 100 }, // baseline
    ];
    const pass = computeScorecard(acted, visits);
    expect(pass.pass.precision).toBe(true); // 4 acted / 4 decided = 1.0
    expect(pass.pass.cleared2x).toBe(true); // 4 cleared ≥ 3
    expect(pass.pass.visitLift).toBe(true); // (200-100)/100 = 1.0
    expect(pass.pass.overall).toBe(true);

    // bump the median so none clear 2× → cleared2x fails → overall fails
    const fail = computeScorecard(
      acted.map((a) => ({ ...a, author_median_reply_impressions: 60 })), // 100 < 120
      visits,
    );
    expect(fail.pass.cleared2x).toBe(false);
    expect(fail.pass.overall).toBe(false);
  });
});
