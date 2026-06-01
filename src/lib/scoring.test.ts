import { describe, it, expect } from "vitest";
import { compositeScore, sizeFit, type ScoreInputs } from "@/lib/scoring";

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

describe("compositeScore — engagement targeting factors", () => {
  const strong = { relevance: 1, likesPerHour: 50, ageHours: 1 };

  // Independently-derived expected value:
  //   relevance=1, velocity=1−exp(−50/200)≈0.2212, recency=0.5^(1/12)≈0.9439
  //   composite = 0.5*1 + 0.3*0.2212 + 0.2*0.9439 ≈ 0.7551
  it("computes a deterministic composite for known inputs (non-tautological)", () => {
    const s = compositeScore({ relevance: 1, likesPerHour: 50, ageHours: 1 });
    expect(s.composite).toBeCloseTo(0.7551, 3);
  });

  it("full credit when author is inside the 5-20x band", () => {
    const inBand = compositeScore({ ...strong, authorFollowers: 25000, ownerFollowerEstimate: 2750 });
    const baseline = compositeScore(strong);
    expect(inBand.composite).toBeCloseTo(baseline.composite);
  });

  it("downranks an author far above the band", () => {
    const huge = compositeScore({ ...strong, authorFollowers: 5_000_000, ownerFollowerEstimate: 2750 });
    const baseline = compositeScore(strong);
    expect(huge.composite).toBeLessThan(baseline.composite);
  });

  it("downranks a crowded post (>20 replies)", () => {
    const crowded = compositeScore({ ...strong, replyCount: 100 });
    const baseline = compositeScore(strong);
    expect(crowded.composite).toBeLessThan(baseline.composite);
  });

  // crowding interpolation
  it("replyCount:20 gives full credit (equals no-replyCount baseline)", () => {
    const baseline = compositeScore(strong);
    const atFull = compositeScore({ ...strong, replyCount: 20 });
    expect(atFull.composite).toBeCloseTo(baseline.composite, 5);
  });

  it("replyCount:60 gives partial composite strictly between replyCount:20 and replyCount:100", () => {
    const full = compositeScore({ ...strong, replyCount: 20 }).composite;
    const partial = compositeScore({ ...strong, replyCount: 60 }).composite;
    const zero = compositeScore({ ...strong, replyCount: 100 }).composite;
    expect(partial).toBeLessThan(full);
    expect(partial).toBeGreaterThan(zero);
  });
});

describe("sizeFit — direct unit tests", () => {
  const owner = 2750;

  it("returns 1.0 when author is exactly 5× owner (lower band edge)", () => {
    expect(sizeFit(5 * owner, owner)).toBe(1);
  });

  it("returns 1.0 when author is exactly 20× owner (upper band edge)", () => {
    expect(sizeFit(20 * owner, owner)).toBe(1);
  });

  it("returns < 1 when author is just below 5× (4× owner)", () => {
    expect(sizeFit(4 * owner, owner)).toBeLessThan(1);
    expect(sizeFit(4 * owner, owner)).toBeCloseTo(0.8, 5);
  });

  it("decays to ~0.5 when author is 40× owner (twice the upper bound)", () => {
    expect(sizeFit(40 * owner, owner)).toBeCloseTo(0.5, 5);
  });

  it("returns 1 when ownerEstimate is 0 (guard against division by zero)", () => {
    expect(sizeFit(10000, 0)).toBe(1);
  });
});
