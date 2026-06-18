import { describe, it, expect } from "vitest";
import { applyWhatIf } from "./whatif";
import type { Trajectory } from "./schemas";

const base: Trajectory = {
  history: [{ date: "2026-06-13", followers: 100 }, { date: "2026-06-14", followers: 108 }],
  projected: [
    { date: "2026-06-15", followers: 110 },
    { date: "2026-06-16", followers: 112 },
  ],
  dailyRate: 2, r2: 1, horizonDays: 2,
};

describe("applyWhatIf", () => {
  it("is identity when all knobs are 1.0", () => {
    const out = applyWhatIf(base, { engagementRate: 1, followConversion: 1, postFrequency: 1 });
    expect(out.projected).toEqual(base.projected);
    expect(out.dailyRate).toBe(2);
  });

  it("doubles the projected rate when the combined multiplier is 2x", () => {
    const out = applyWhatIf(base, { engagementRate: 2, followConversion: 1, postFrequency: 1 });
    expect(out.dailyRate).toBe(4);
    expect(out.projected[0].followers).toBe(112); // 108 + 4*1
    expect(out.projected[1].followers).toBe(116); // 108 + 4*2
  });

  it("leaves history untouched", () => {
    const out = applyWhatIf(base, { engagementRate: 0.5, followConversion: 1, postFrequency: 1 });
    expect(out.history).toEqual(base.history);
  });
});
