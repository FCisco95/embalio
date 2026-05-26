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
});
