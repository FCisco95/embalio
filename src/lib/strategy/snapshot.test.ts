import { describe, it, expect } from "vitest";
import { weekOfUTC, buildStrategySnapshot } from "./snapshot";

describe("snapshot", () => {
  it("weekOfUTC returns the Monday (UTC) of the given instant", () => {
    // 2026-06-18 is a Thursday → Monday is 2026-06-15
    expect(weekOfUTC(Date.parse("2026-06-18T12:00:00Z"))).toBe("2026-06-15");
    expect(weekOfUTC(Date.parse("2026-06-15T00:00:00Z"))).toBe("2026-06-15");
  });

  it("assembles a schema-valid snapshot", () => {
    const snap = buildStrategySnapshot({
      weekOf: "2026-06-15",
      cluster: { alignment: 0.7, band: "core", nicheSize: 10, spread: 0.2 },
      targets: { picks: [], generatedAt: "2026-06-18" },
      attribution: { status: "insufficient_data", n: 0, minN: 20, message: "m" },
      recommendations: { adds: [], drops: [] },
      generatedAt: "2026-06-18T00:00:00.000Z",
    });
    expect(snap.weekOf).toBe("2026-06-15");
  });
});
