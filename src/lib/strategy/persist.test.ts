import { describe, it, expect } from "vitest";
import { buildStrategySnapshotRecord } from "./persist";
import type { StrategySnapshot } from "./schemas";

const snap: StrategySnapshot = {
  weekOf: "2026-06-15",
  cluster: { alignment: 0.5, band: "edge", nicheSize: 8, spread: 0.3 },
  targets: { picks: [], generatedAt: "2026-06-18" },
  attribution: { status: "insufficient_data", n: 0, minN: 20, message: "m" },
  recommendations: { adds: [], drops: [] },
  generatedAt: "2026-06-18T00:00:00.000Z",
};

describe("buildStrategySnapshotRecord", () => {
  it("builds a record keyed by profile + week", () => {
    const rec = buildStrategySnapshotRecord(snap, "profile-1");
    expect(rec).toEqual({ profile_id: "profile-1", week_of: "2026-06-15", snapshot_json: snap });
  });

  it("throws on an invalid snapshot", () => {
    expect(() => buildStrategySnapshotRecord({ ...snap, weekOf: 123 as unknown as string }, "p1")).toThrow();
  });
});
