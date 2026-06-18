import { describe, it, expect } from "vitest";
import { recommendAddsDrops } from "./recommend";
import type { EngagementTarget } from "@/lib/schemas";

const pick = (handle: string): EngagementTarget => ({ handle, priority: "high", reason: "r", suggested_approach: "a" });

describe("recommendAddsDrops", () => {
  it("adds picks not already followed; drops active seeds with zero activity", () => {
    const out = recommendAddsDrops({
      picks: [pick("@new"), pick("@existing")],
      activeSeedHandles: ["@existing", "@dead"],
      activityByHandle: { "@existing": 4, "@dead": 0 },
    });
    expect(out.adds.map((a) => a.handle)).toEqual(["@new"]);
    expect(out.drops.map((d) => d.handle)).toEqual(["@dead"]);
  });

  it("caps drops", () => {
    const out = recommendAddsDrops({
      picks: [], activeSeedHandles: ["@a", "@b", "@c"], activityByHandle: {}, maxDrops: 2,
    });
    expect(out.drops).toHaveLength(2);
  });
});
