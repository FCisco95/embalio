import { describe, it, expect } from "vitest";
import { centroid, clusterPosition } from "./cluster";

describe("cluster", () => {
  it("mean-pools vectors into a centroid", () => {
    expect(centroid([[0, 0], [2, 2]])).toEqual([1, 1]);
    expect(centroid([])).toEqual([]);
  });

  it("classifies an aligned account as core and a divergent one as outside", () => {
    const niche = [[1, 0], [0.9, 0.1]];
    expect(clusterPosition({ accountVec: [1, 0], nicheVecs: niche }).band).toBe("core");
    expect(clusterPosition({ accountVec: [-1, 0], nicheVecs: niche }).band).toBe("outside");
  });

  it("returns zero alignment when an input is empty (no throw)", () => {
    expect(clusterPosition({ accountVec: [], nicheVecs: [] }).alignment).toBe(0);
  });
});
