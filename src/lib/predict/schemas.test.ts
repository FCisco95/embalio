import { describe, it, expect } from "vitest";
import { Trajectory, WeeklyForecast, WhatIfKnobs, BreakoutPrecheck, PredictionRecord } from "./schemas";

describe("predict schemas", () => {
  it("accepts a valid trajectory", () => {
    const t = {
      history: [{ date: "2026-06-01", followers: 100 }],
      projected: [{ date: "2026-06-08", followers: 110 }],
      dailyRate: 1.4, r2: 0.92, horizonDays: 7,
    };
    expect(Trajectory.parse(t)).toEqual(t);
  });

  it("rejects a trajectory with a non-int follower count", () => {
    expect(() => Trajectory.parse({ history: [{ date: "2026-06-01", followers: 1.5 }], projected: [], dailyRate: 0, r2: 0, horizonDays: 7 })).toThrow();
  });

  it("defaults what-if knobs to 1.0", () => {
    expect(WhatIfKnobs.parse({})).toEqual({ engagementRate: 1, followConversion: 1, postFrequency: 1 });
  });

  it("bounds the breakout 0-100 score", () => {
    expect(() => BreakoutPrecheck.parse({ score: 101, band: "strong", verdict: "x", fixes: [] })).toThrow();
  });

  it("accepts a prediction record", () => {
    const r = { type: "weekly_forecast", value_json: { a: 1 }, created_at: "2026-06-18T00:00:00.000Z", expires_at: "2026-06-25T00:00:00.000Z" };
    expect(PredictionRecord.parse(r)).toEqual(r);
  });

  it("validates a weekly-forecast shape", () => {
    const f = { currentFollowers: 100, predictedFollowers: 114, predictedDate: "2026-06-21", dailyRate: 2, low: 108, high: 120, r2: 0.8, basisDays: 14 };
    expect(WeeklyForecast.parse(f)).toEqual(f);
  });
});
