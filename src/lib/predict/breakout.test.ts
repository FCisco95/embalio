import { describe, it, expect } from "vitest";
import { breakoutScore0to100, summarizeBreakout } from "./breakout";

describe("breakoutScore0to100", () => {
  it("maps the 1-7 scale onto 0-100 endpoints", () => {
    expect(breakoutScore0to100(1)).toBe(0);
    expect(breakoutScore0to100(4)).toBe(50);
    expect(breakoutScore0to100(7)).toBe(100);
  });
  it("clamps out-of-range model output", () => {
    expect(breakoutScore0to100(0)).toBe(0);
    expect(breakoutScore0to100(9)).toBe(100);
  });
});

describe("summarizeBreakout", () => {
  it("bands and carries verdict + fixes through", () => {
    const out = summarizeBreakout({ score: 6, verdict: "hook is strong", hook_strength: "strong", fixes: ["add a number"] });
    expect(out).toEqual({ score: 83, band: "strong", verdict: "hook is strong", fixes: ["add a number"] });
  });
  it("bands a weak draft", () => {
    expect(summarizeBreakout({ score: 2, verdict: "noise", hook_strength: "weak", fixes: [] }).band).toBe("weak");
  });
});
