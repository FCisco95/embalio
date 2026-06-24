import { describe, it, expect } from "vitest";
import { cosine, relevanceFromVectors } from "@/lib/embeddings";

describe("cosine", () => {
  it("is 1 for identical vectors", () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
  });
  it("is 0 for orthogonal vectors", () => {
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });
  it("relevanceFromVectors maps [-1,1] cosine into [0,1]", () => {
    expect(relevanceFromVectors([1, 0], [1, 0])).toBeCloseTo(1);
    expect(relevanceFromVectors([1, 0], [-1, 0])).toBeCloseTo(0);
  });
  it("returns 0 for a degenerate (zero/empty) embedding, not a misleading 0.5", () => {
    // A failed/empty embedding comes back as a zero vector; it must NOT score 0.5
    // ("half relevant") and let a fresh in-band post clear the sniper threshold on
    // freshness alone.
    expect(relevanceFromVectors([0, 0], [1, 0])).toBe(0);
    expect(relevanceFromVectors([1, 0], [0, 0])).toBe(0);
    expect(relevanceFromVectors([1, 0], [])).toBe(0);
    // but a genuinely orthogonal pair of REAL vectors still maps to 0.5
    expect(relevanceFromVectors([1, 0], [0, 1])).toBeCloseTo(0.5);
  });
});
