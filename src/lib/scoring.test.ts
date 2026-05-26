import { describe, it, expect } from "vitest";
import { compositeScore, type ScoreInputs } from "@/lib/scoring";

const base: ScoreInputs = { relevance: 1, likesPerHour: 0, ageHours: 0 };

describe("compositeScore", () => {
  it("returns relevance, velocity, recency and a weighted composite in [0,1]", () => {
    const s = compositeScore({ relevance: 0.8, likesPerHour: 50, ageHours: 1 });
    expect(s.relevance).toBeCloseTo(0.8);
    expect(s.velocity).toBeGreaterThan(0);
    expect(s.recency).toBeGreaterThan(0.9);
    expect(s.composite).toBeGreaterThan(0);
    expect(s.composite).toBeLessThanOrEqual(1);
  });

  it("decays recency as age grows", () => {
    const fresh = compositeScore({ ...base, relevance: 0.5, ageHours: 1 }).recency;
    const stale = compositeScore({ ...base, relevance: 0.5, ageHours: 48 }).recency;
    expect(fresh).toBeGreaterThan(stale);
  });

  it("velocity saturates (never exceeds 1)", () => {
    const s = compositeScore({ relevance: 0.5, likesPerHour: 100000, ageHours: 1 });
    expect(s.velocity).toBeLessThanOrEqual(1);
  });
});
