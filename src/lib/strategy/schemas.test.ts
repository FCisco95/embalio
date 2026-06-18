import { describe, it, expect } from "vitest";
import {
  ClusterPosition, StrategyTargets, ReplyFollowAttribution,
  RecommendationDeltas, StrategySnapshot, StrategySnapshotRecord,
} from "./schemas";

const target = { handle: "@paulg", reason: "high niche overlap", priority: "high" as const, suggested_approach: "reply to his startup threads" };

describe("strategy schemas", () => {
  it("accepts a valid cluster position and rejects out-of-range alignment", () => {
    expect(ClusterPosition.parse({ alignment: 0.7, band: "core", nicheSize: 12, spread: 0.3 }).band).toBe("core");
    expect(() => ClusterPosition.parse({ alignment: 1.4, band: "core", nicheSize: 1, spread: 0 })).toThrow();
  });

  it("caps strategy targets at 20", () => {
    const picks = Array.from({ length: 21 }, (_, i) => ({ ...target, handle: `@u${i}` }));
    expect(() => StrategyTargets.parse({ picks, generatedAt: "2026-06-18" })).toThrow();
  });

  it("attribution forces the correlation label and never carries a causal field", () => {
    const a = ReplyFollowAttribution.parse({ status: "correlation", n: 28, r: 0.4, label: "correlation", disclaimer: "x" });
    expect(a.status === "correlation" && a.label).toBe("correlation");
    expect(() => ReplyFollowAttribution.parse({ status: "correlation", n: 28, r: 0.4, label: "causation", disclaimer: "x" })).toThrow();
    const insuf = ReplyFollowAttribution.parse({ status: "insufficient_data", n: 5, minN: 20, message: "m" });
    expect(insuf.status).toBe("insufficient_data");
  });

  it("round-trips a full snapshot record", () => {
    const snap = StrategySnapshot.parse({
      weekOf: "2026-06-15",
      cluster: { alignment: 0.7, band: "core", nicheSize: 12, spread: 0.3 },
      targets: { picks: [target], generatedAt: "2026-06-18" },
      attribution: { status: "insufficient_data", n: 5, minN: 20, message: "m" },
      recommendations: { adds: [target], drops: [{ handle: "@dead", reason: "no activity" }] },
      generatedAt: "2026-06-18T00:00:00.000Z",
    });
    const rec = StrategySnapshotRecord.parse({ profile_id: "p1", week_of: snap.weekOf, snapshot_json: snap });
    expect(rec.week_of).toBe("2026-06-15");
  });
});
