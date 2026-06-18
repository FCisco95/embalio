import { describe, it, expect } from "vitest";
import { projectTrajectory } from "./trajectory";

const snap = (date: string, followers: number) => ({ snapshot_date: date, followers });

describe("projectTrajectory", () => {
  it("returns null with fewer than two snapshots and no fallback", () => {
    expect(projectTrajectory([snap("2026-06-16", 100)], 7)).toBeNull();
  });

  it("extends a +2/day history by horizonDays from the last actual", () => {
    const snaps = Array.from({ length: 5 }, (_, i) =>
      snap(`2026-06-${String(10 + i).padStart(2, "0")}`, 100 + i * 2)); // 100..108
    const t = projectTrajectory(snaps, 7)!;
    expect(t.history).toHaveLength(5);
    expect(t.history[4]).toEqual({ date: "2026-06-14", followers: 108 });
    expect(t.dailyRate).toBeCloseTo(2, 1);
    expect(t.projected).toHaveLength(7);
    expect(t.projected[0].date).toBe("2026-06-15");
    expect(t.projected[6].followers).toBe(122); // 108 + 7*2
    expect(t.horizonDays).toBe(7);
  });
});
