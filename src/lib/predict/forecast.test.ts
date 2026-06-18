import { describe, it, expect } from "vitest";
import { weeklyForecast, endOfWeekUTC } from "./forecast";

const snap = (date: string, followers: number) => ({ snapshot_date: date, followers });
// Wed 2026-06-17 12:00Z
const NOW = Date.parse("2026-06-17T12:00:00Z");

describe("endOfWeekUTC", () => {
  it("rolls forward to the upcoming Sunday (YYYY-MM-DD)", () => {
    expect(endOfWeekUTC(NOW)).toBe("2026-06-21");
  });
});

describe("weeklyForecast", () => {
  it("returns null with fewer than two snapshots and no fallback", () => {
    expect(weeklyForecast([snap("2026-06-16", 100)], NOW)).toBeNull();
  });

  it("uses the analytics_daily fallback rate with a single snapshot", () => {
    const f = weeklyForecast([snap("2026-06-16", 100)], NOW, 5)!;
    expect(f.currentFollowers).toBe(100);
    expect(f.dailyRate).toBe(5);
    expect(f.predictedFollowers).toBe(125);
    expect(f.low).toBe(125);
    expect(f.high).toBe(125);
    expect(f.basisDays).toBe(1);
  });

  it("projects a steady +2/day series to end of week", () => {
    const snaps = Array.from({ length: 8 }, (_, i) =>
      snap(`2026-06-${String(10 + i).padStart(2, "0")}`, 100 + i * 2)); // 10th..17th, 100..114
    const f = weeklyForecast(snaps, NOW)!;
    expect(f.currentFollowers).toBe(114);
    expect(f.dailyRate).toBeCloseTo(2, 1);
    expect(f.predictedFollowers).toBe(122);
    expect(f.predictedDate).toBe("2026-06-21");
    expect(f.low).toBeLessThanOrEqual(f.predictedFollowers);
    expect(f.high).toBeGreaterThanOrEqual(f.predictedFollowers);
    expect(f.basisDays).toBe(8);
  });
});
