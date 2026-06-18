import { describe, it, expect } from "vitest";
import { buildPredictionRecord } from "./persist";

const NOW = Date.parse("2026-06-18T00:00:00Z");

describe("buildPredictionRecord", () => {
  it("stamps created_at and a ttl-based expires_at", () => {
    const r = buildPredictionRecord("weekly_forecast", { predictedFollowers: 120 }, NOW, 7);
    expect(r.type).toBe("weekly_forecast");
    expect(r.value_json).toEqual({ predictedFollowers: 120 });
    expect(r.created_at).toBe("2026-06-18T00:00:00.000Z");
    expect(r.expires_at).toBe("2026-06-25T00:00:00.000Z");
  });
  it("null expires_at when ttlDays is null", () => {
    const r = buildPredictionRecord("breakout", { score: 80 }, NOW, null);
    expect(r.expires_at).toBeNull();
  });
});
