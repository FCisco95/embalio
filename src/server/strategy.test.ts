import { describe, it, expect, vi, beforeEach } from "vitest";

const assertOwnProfile = vi.fn<(id: string) => Promise<void>>();
vi.mock("@/server/auth", () => ({ assertOwnProfile: (id: string) => assertOwnProfile(id) }));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => { throw new Error("db down"); },
  supabaseService: () => { throw new Error("db down"); },
}));

import { getStrategyBoard, applyTargetRecommendation, runWeeklyStrategy } from "./strategy";

describe("strategy server actions", () => {
  beforeEach(() => {
    assertOwnProfile.mockReset().mockResolvedValue(undefined);
  });

  it("getStrategyBoard and applyTargetRecommendation report a foreign profile as ok:false", async () => {
    assertOwnProfile.mockRejectedValue(new Error("Profile not found or access denied"));
    const board = await getStrategyBoard("foreign");
    expect(board).toEqual({ ok: false, error: "Profile not found or access denied" });
    const applied = await applyTargetRecommendation("foreign", { adds: ["a"], drops: [] });
    expect(applied).toEqual({ ok: false, error: "Profile not found or access denied" });
  });

  it("runWeeklyStrategy never asks for a session — /api/cron/strategy has none", async () => {
    const r = await runWeeklyStrategy("p1");
    expect(assertOwnProfile).not.toHaveBeenCalled();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("db down");
  });

  it("getStrategyBoard returns an error discriminant instead of throwing", async () => {
    const r = await getStrategyBoard("p1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("db down");
  });

  it("applyTargetRecommendation refuses an empty decision (human-in-the-loop, no auto-act)", async () => {
    const r = await applyTargetRecommendation("p1", { adds: [], drops: [] });
    expect(r.ok).toBe(false);
  });
});
