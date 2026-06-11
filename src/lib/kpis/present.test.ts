import { describe, it, expect } from "vitest";
import { formatRate, formatPerDay, formatDelta, bandChip } from "./present";

describe("formatRate", () => {
  it("formats a fraction as a 1-decimal percent", () => {
    expect(formatRate(0.043)).toBe("4.3%");
  });
  it("em-dash for null", () => {
    expect(formatRate(null)).toBe("—");
  });
});

describe("formatPerDay", () => {
  it("1 decimal under 10, rounded above", () => {
    expect(formatPerDay(3.2857)).toBe("3.3");
    expect(formatPerDay(14.4)).toBe("14");
  });
  it("em-dash for null", () => {
    expect(formatPerDay(null)).toBe("—");
  });
});

describe("formatDelta", () => {
  it("signs positives, keeps negatives, em-dash for null", () => {
    expect(formatDelta(12)).toBe("+12");
    expect(formatDelta(-3)).toBe("-3");
    expect(formatDelta(0)).toBe("+0");
    expect(formatDelta(null)).toBe("—");
  });
});

describe("bandChip", () => {
  it("labels each band and returns null for null", () => {
    expect(bandChip("good")?.text).toBe("3–8% healthy");
    expect(bandChip("low")?.text).toContain("below 3%");
    expect(bandChip("high")?.text).toContain("above 8%");
    expect(bandChip(null)).toBeNull();
  });
});
