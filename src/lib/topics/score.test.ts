import { describe, it, expect } from "vitest";
import { scoreTopic, type ScoreInput } from "./score";
import { computeHeat } from "./heat";

const base: ScoreInput = {
  nicheFit01: 1,
  heat: computeHeat(20, 2), // heat01 = 1
  credibilityKept: true,
  freshestSourceAgeHours: 1,
  kind: "spike",
};

describe("scoreTopic", () => {
  it("perfect inputs → 100, react window", () => {
    const s = scoreTopic(base);
    expect(s.score).toBe(100);
    expect(s.window).toBe("react");
    expect(s.why).toEqual({ niche_fit: 35, heat: 30, credibility: 20, timing: 15 });
  });
  it("source <2h old → react window", () => {
    expect(scoreTopic({ ...base, heat: computeHeat(1, 1), freshestSourceAgeHours: 1.5 }).window).toBe("react");
  });
  it("source >48h old → saturated", () => {
    expect(scoreTopic({ ...base, freshestSourceAgeHours: 50 }).window).toBe("saturated");
  });
  it("declining warehouse velocity with real prior volume → saturated", () => {
    expect(scoreTopic({ ...base, heat: computeHeat(2, 8), freshestSourceAgeHours: 12 }).window).toBe("saturated");
  });
  it("mid-age, steady → verdict window", () => {
    expect(scoreTopic({ ...base, heat: computeHeat(3, 3), freshestSourceAgeHours: 12 }).window).toBe("verdict");
  });
  it("unparseable source date → verdict (never react)", () => {
    expect(scoreTopic({ ...base, heat: computeHeat(0, 0), freshestSourceAgeHours: null }).window).toBe("verdict");
  });
  it("not-kept credibility zeroes that component", () => {
    const s = scoreTopic({ ...base, credibilityKept: false });
    expect(s.why.credibility).toBe(0);
    expect(s.score).toBe(80);
  });
  it("score is clamped int 0-100", () => {
    const s = scoreTopic({ nicheFit01: 0, heat: computeHeat(0, 0), credibilityKept: false, freshestSourceAgeHours: null, kind: "durable" });
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(s.score)).toBe(true);
  });
});
