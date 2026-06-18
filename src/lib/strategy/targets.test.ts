import { describe, it, expect } from "vitest";
import { shapeStrategyTargets, mergeApproachScan } from "./targets";
import type { EngagementTarget } from "@/lib/schemas";

const t = (handle: string, priority: EngagementTarget["priority"]): EngagementTarget =>
  ({ handle, priority, reason: "r", suggested_approach: "a" });

describe("shapeStrategyTargets", () => {
  it("orders by priority, dedupes by handle (case-insensitive), and excludes given handles", () => {
    const out = shapeStrategyTargets(
      [t("@b", "low"), t("@a", "high"), t("@A", "high"), t("@c", "medium")],
      "2026-06-18",
      { excludeHandles: ["@c"] },
    );
    expect(out.picks.map((p) => p.handle)).toEqual(["@a", "@b"]);
    expect(out.generatedAt).toBe("2026-06-18");
  });

  it("clamps to max", () => {
    const many = Array.from({ length: 25 }, (_, i) => t(`@u${i}`, "medium"));
    expect(shapeStrategyTargets(many, "2026-06-18", { max: 20 }).picks).toHaveLength(20);
  });

  it("mergeApproachScan appends a recent-activity note only where a scan line exists", () => {
    const out = mergeApproachScan([t("@a", "high"), t("@b", "low")], { "@a": "shipped a new feature" });
    expect(out[0].suggested_approach).toContain("Recent: shipped a new feature");
    expect(out[1].suggested_approach).toBe("a"); // untouched
  });
});
