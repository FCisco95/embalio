import { describe, it, expect } from "vitest";
import { blendedDailyRate, avgDailyFollowsPerDay } from "./rate";

const snap = (date: string, followers: number) => ({ snapshot_date: date, followers });

describe("blendedDailyRate", () => {
  it("returns null for an empty series and no fallback", () => {
    expect(blendedDailyRate([], null)).toBeNull();
  });
  it("returns the fallback (r2 0, sigma 0) when fewer than two snapshots", () => {
    expect(blendedDailyRate([snap("2026-06-16", 100)], 3)).toEqual({ dailyRate: 3, r2: 0, sigma: 0 });
  });
  it("returns null with one snapshot and no fallback", () => {
    expect(blendedDailyRate([snap("2026-06-16", 100)], null)).toBeNull();
  });
  it("blends OLS slope + EMA deltas on a steady +2/day series", () => {
    const snaps = Array.from({ length: 5 }, (_, i) =>
      snap(`2026-06-${String(10 + i).padStart(2, "0")}`, 100 + i * 2));
    const rf = blendedDailyRate(snaps, null)!;
    expect(rf.dailyRate).toBeCloseTo(2, 10);
    expect(rf.r2).toBeCloseTo(1, 10);
    expect(rf.sigma).toBeCloseTo(0, 10);
  });
});

describe("avgDailyFollowsPerDay", () => {
  it("is null for no rows", () => { expect(avgDailyFollowsPerDay([])).toBeNull(); });
  it("averages new_follows over the rows", () => {
    expect(avgDailyFollowsPerDay([{ new_follows: 2 }, { new_follows: 4 }])).toBe(3);
  });
});
