import { describe, it, expect } from "vitest";
import { AnalyticsDay, KpiSummary } from "./schemas";

describe("AnalyticsDay", () => {
  it("parses string cells, stripping thousands separators", () => {
    const r = AnalyticsDay.parse({ date: "2026-06-07", profile_visits: "1,234", new_follows: "5" });
    expect(r).toMatchObject({ date: "2026-06-07", profile_visits: 1234, new_follows: 5 });
  });

  it("accepts optional metric columns and leaves absent ones undefined", () => {
    const r = AnalyticsDay.parse({ date: "2026-06-07", profile_visits: "10", new_follows: "1", impressions: "900" });
    expect(r.impressions).toBe(900);
    expect(r.likes).toBeUndefined();
  });

  it("rejects non-numeric garbage instead of coercing to 0", () => {
    expect(AnalyticsDay.safeParse({ date: "2026-06-07", profile_visits: "n/a", new_follows: "1" }).success).toBe(false);
  });

  it("rejects negative and non-integer counts", () => {
    expect(AnalyticsDay.safeParse({ date: "2026-06-07", profile_visits: "-3", new_follows: "1" }).success).toBe(false);
    expect(AnalyticsDay.safeParse({ date: "2026-06-07", profile_visits: "1.5", new_follows: "1" }).success).toBe(false);
  });

  it("rejects a missing required column (empty cell was dropped by the parser)", () => {
    expect(AnalyticsDay.safeParse({ date: "2026-06-07", new_follows: "1" }).success).toBe(false);
  });

  it("rejects a non-ISO date", () => {
    expect(AnalyticsDay.safeParse({ date: "Jun 7", profile_visits: "1", new_follows: "1" }).success).toBe(false);
  });
});

describe("KpiSummary", () => {
  it("accepts a fully-null summary (no data yet)", () => {
    const r = KpiSummary.parse({
      followsPerDay7d: null, visitsPerDay7d: null, followRate7d: null, followRateBand: null,
      followerCount: null, followerDelta7d: null,
      followerSeries: [], visitsSeries: [], followsSeries: [], rateSeries: [],
      dataThrough: null, lastImportAt: null, staleDays: null,
    });
    expect(r.followRate7d).toBeNull();
  });

  it("rejects an invalid band", () => {
    expect(
      KpiSummary.safeParse({
        followsPerDay7d: 1, visitsPerDay7d: 1, followRate7d: 0.05, followRateBand: "amazing",
        followerCount: 1, followerDelta7d: 0,
        followerSeries: [], visitsSeries: [], followsSeries: [], rateSeries: [],
        dataThrough: "2026-06-07", lastImportAt: null, staleDays: 0,
      }).success,
    ).toBe(false);
  });
});
