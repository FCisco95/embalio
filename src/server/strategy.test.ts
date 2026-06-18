import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => { throw new Error("db down"); },
  supabaseService: () => { throw new Error("db down"); },
}));

import { getStrategyBoard, applyTargetRecommendation } from "./strategy";

describe("strategy server actions", () => {
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
