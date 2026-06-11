import { describe, it, expect } from "vitest";
import { computeKpis, computeFollowerStat, followRateBand, dedupeSnapshots } from "./aggregate";

const day = (date: string, visits: number, follows: number, imported_at = "2026-06-11T08:00:00Z") =>
  ({ date, profile_visits: visits, new_follows: follows, imported_at });
const snap = (snapshot_date: string, followers: number, captured_at = `${snapshot_date}T07:30:00Z`) =>
  ({ snapshot_date, followers, captured_at });

const NOW = Date.parse("2026-06-11T12:00:00Z");

describe("followRateBand", () => {
  it("bands at the 3% and 8% edges (3–8% healthy)", () => {
    expect(followRateBand(0.029)).toBe("low");
    expect(followRateBand(0.03)).toBe("good");
    expect(followRateBand(0.08)).toBe("good");
    expect(followRateBand(0.081)).toBe("high");
  });
});

describe("dedupeSnapshots", () => {
  it("keeps the newest captured_at per day and sorts ascending", () => {
    const out = dedupeSnapshots([
      snap("2026-06-10", 100, "2026-06-10T07:00:00Z"),
      snap("2026-06-10", 105, "2026-06-10T22:00:00Z"),
      snap("2026-06-09", 98),
    ]);
    expect(out.map((s) => s.followers)).toEqual([98, 105]);
  });

  it("compares captured_at as timestamps, not strings", () => {
    const out = dedupeSnapshots([
      snap("2026-06-10", 100, "Wed, 10 Jun 2026 22:00:00 GMT"),
      snap("2026-06-10", 105, "2026-06-10T07:00:00Z"),
    ]);
    expect(out[0].followers).toBe(100); // 22:00 GMT beats 07:00Z regardless of format
  });
});

describe("computeFollowerStat", () => {
  it("returns count, 7d delta vs the snapshot at/before -7d, and a series capped at 14 (10 here)", () => {
    const snaps = Array.from({ length: 10 }, (_, i) => snap(`2026-06-${String(i + 2).padStart(2, "0")}`, 100 + i));
    const stat = computeFollowerStat(snaps)!;
    expect(stat.followers).toBe(109); // 2026-06-11
    expect(stat.delta7d).toBe(109 - 102); // baseline 2026-06-04
    expect(stat.series).toHaveLength(10);
    expect(stat.series[0].date).toBe("2026-06-02");
  });
  it("null delta when no snapshot reaches back 7 days", () => {
    expect(computeFollowerStat([snap("2026-06-10", 100), snap("2026-06-11", 103)])!.delta7d).toBeNull();
  });
  it("null when no snapshots", () => {
    expect(computeFollowerStat([])).toBeNull();
  });
});

describe("computeKpis", () => {
  it("computes 7d averages anchored to the newest data day, dividing by days with data", () => {
    const k = computeKpis({
      analytics: [day("2026-06-05", 100, 4), day("2026-06-06", 150, 5), day("2026-06-07", 50, 3)],
      snapshots: [],
      now: NOW,
    });
    expect(k.visitsPerDay7d).toBe(100); // (100+150+50)/3
    expect(k.followsPerDay7d).toBe(4); // (4+5+3)/3
    expect(k.followRate7d).toBeCloseTo(12 / 300);
    expect(k.followRateBand).toBe("good"); // 4%
    expect(k.dataThrough).toBe("2026-06-07");
    expect(k.staleDays).toBe(4); // 06-07 → 06-11
  });

  it("excludes rows older than 7 days before dataThrough from the window", () => {
    const k = computeKpis({
      analytics: [day("2026-05-01", 1000, 100), day("2026-06-07", 50, 2)],
      snapshots: [],
      now: NOW,
    });
    expect(k.visitsPerDay7d).toBe(50);
    expect(k.followsPerDay7d).toBe(2);
  });

  it("null follow rate when the window has zero visits", () => {
    const k = computeKpis({ analytics: [day("2026-06-07", 0, 2)], snapshots: [], now: NOW });
    expect(k.followRate7d).toBeNull();
    expect(k.followRateBand).toBeNull();
  });

  it("all-null summary when there is no analytics data", () => {
    const k = computeKpis({ analytics: [], snapshots: [snap("2026-06-10", 50)], now: NOW });
    expect(k.followsPerDay7d).toBeNull();
    expect(k.dataThrough).toBeNull();
    expect(k.staleDays).toBeNull();
    expect(k.followerCount).toBe(50); // snapshots still feed the follower card
  });

  it("series are ascending and capped at 14 points; lastImportAt is the max", () => {
    const analytics = Array.from({ length: 20 }, (_, i) =>
      day(`2026-05-${String(i + 10).padStart(2, "0")}`, 10, 1, `2026-06-0${(i % 9) + 1}T00:00:00Z`));
    const k = computeKpis({ analytics, snapshots: [], now: NOW });
    expect(k.visitsSeries).toHaveLength(14);
    expect(k.visitsSeries[0].date < k.visitsSeries[13].date).toBe(true);
    expect(k.lastImportAt).toBe("2026-06-09T00:00:00Z");
  });

  it("rateSeries uses 0 for zero-visit days (chartable, not null)", () => {
    const k = computeKpis({ analytics: [day("2026-06-06", 0, 2), day("2026-06-07", 100, 4)], snapshots: [], now: NOW });
    expect(k.rateSeries).toEqual([
      { date: "2026-06-06", value: 0 },
      { date: "2026-06-07", value: 0.04 },
    ]);
  });

  it("throws loudly at the KpiSummary boundary on corrupt input (NaN now)", () => {
    expect(() => computeKpis({ analytics: [day("2026-06-07", 1, 1)], snapshots: [], now: NaN })).toThrow();
  });
});
