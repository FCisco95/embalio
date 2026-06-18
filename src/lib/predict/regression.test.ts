import { describe, it, expect } from "vitest";
import { linearRegression, ema } from "./regression";

describe("linearRegression", () => {
  it("fits a perfect line: y = 2x + 1, r2 = 1", () => {
    const r = linearRegression([{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }]);
    expect(r.slope).toBeCloseTo(2, 10);
    expect(r.intercept).toBeCloseTo(1, 10);
    expect(r.r2).toBeCloseTo(1, 10);
  });
  it("returns slope 0 and r2 0 for flat data", () => {
    const r = linearRegression([{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }]);
    expect(r.slope).toBeCloseTo(0, 10);
    expect(r.r2).toBe(0);
  });
  it("throws on fewer than two points", () => {
    expect(() => linearRegression([{ x: 0, y: 1 }])).toThrow();
  });
});

describe("ema", () => {
  it("equals the single value for one element", () => { expect(ema([10], 0.5)).toBe(10); });
  it("weights recent values: alpha 1 returns the last value", () => { expect(ema([1, 2, 99], 1)).toBe(99); });
  it("computes the recurrence for alpha 0.5", () => { expect(ema([2, 4, 6], 0.5)).toBeCloseTo(4.5, 10); });
  it("throws on empty input", () => { expect(() => ema([], 0.5)).toThrow(); });
});
