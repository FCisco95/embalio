import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: vi.fn() }));
describe("getStreak", () => {
  beforeEach(() => vi.clearAllMocks());
  it("reads posted_at and returns the computed streak", async () => {
    const { supabaseServer } = await import("@/lib/supabase/server");
    (supabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: () => ({ select: () => ({ eq: () => ({ data: [{ posted_at: new Date().toISOString() }], error: null }) }) }),
    });
    const { getStreak } = await import("@/server/streak");
    expect(await getStreak("p1")).toBeGreaterThanOrEqual(1);
  });
  it("returns 0 on db error (fails safe)", async () => {
    const { supabaseServer } = await import("@/lib/supabase/server");
    (supabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: () => ({ select: () => ({ eq: () => ({ data: null, error: { message: "boom" } }) }) }),
    });
    const { getStreak } = await import("@/server/streak");
    expect(await getStreak("p1")).toBe(0);
  });
});
