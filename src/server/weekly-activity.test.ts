import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: vi.fn() }));

function makeSb({
  postsCount = 0 as number | null,
  repliesCount = 0 as number | null,
  profile = { bio_optimized: false, pinned_optimized: false },
  postsError = null as null | { message: string },
  repliesError = null as null | { message: string },
  profileError = null as null | { message: string },
} = {}) {
  return {
    from: (table: string) => {
      if (table === "posts") {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({ count: postsCount, error: postsError }),
            }),
          }),
        };
      }
      if (table === "activity_events") {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                gte: () => ({ count: repliesCount, error: repliesError }),
              }),
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({ data: profileError ? null : profile, error: profileError }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };
}

describe("getWeeklyActivity", () => {
  beforeEach(() => vi.resetModules());

  it("returns zeros when no data exists", async () => {
    const { supabaseServer } = await import("@/lib/supabase/server");
    (supabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(makeSb());
    const { getWeeklyActivity } = await import("@/server/weekly-activity");
    const result = await getWeeklyActivity("p1");
    expect(result).toEqual({
      postsThisWeek: 0,
      repliesThisWeek: 0,
      bioOptimized: false,
      pinnedOptimized: false,
    });
  });

  it("returns post count from posts table", async () => {
    const { supabaseServer } = await import("@/lib/supabase/server");
    (supabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(makeSb({ postsCount: 3 }));
    const { getWeeklyActivity } = await import("@/server/weekly-activity");
    const result = await getWeeklyActivity("p1");
    expect(result.postsThisWeek).toBe(3);
  });

  it("returns reply count from activity_events", async () => {
    const { supabaseServer } = await import("@/lib/supabase/server");
    (supabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(makeSb({ repliesCount: 14 }));
    const { getWeeklyActivity } = await import("@/server/weekly-activity");
    const result = await getWeeklyActivity("p1");
    expect(result.repliesThisWeek).toBe(14);
  });

  it("reflects profile optimization flags", async () => {
    const { supabaseServer } = await import("@/lib/supabase/server");
    (supabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSb({ profile: { bio_optimized: true, pinned_optimized: false } })
    );
    const { getWeeklyActivity } = await import("@/server/weekly-activity");
    const result = await getWeeklyActivity("p1");
    expect(result.bioOptimized).toBe(true);
    expect(result.pinnedOptimized).toBe(false);
  });

  it("falls back to false when profile query fails", async () => {
    const { supabaseServer } = await import("@/lib/supabase/server");
    (supabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSb({ profileError: { message: "not found" } })
    );
    const { getWeeklyActivity } = await import("@/server/weekly-activity");
    const result = await getWeeklyActivity("p1");
    expect(result.bioOptimized).toBe(false);
    expect(result.pinnedOptimized).toBe(false);
  });

  it("returns 0 when DB returns null count for posts (Supabase error path)", async () => {
    const { supabaseServer } = await import("@/lib/supabase/server");
    (supabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSb({ postsCount: null, postsError: { message: "connection reset" } })
    );
    const { getWeeklyActivity } = await import("@/server/weekly-activity");
    const result = await getWeeklyActivity("p1");
    expect(result.postsThisWeek).toBe(0);
  });

  it("returns 0 when DB returns null count for replies (Supabase error path)", async () => {
    const { supabaseServer } = await import("@/lib/supabase/server");
    (supabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSb({ repliesCount: null, repliesError: { message: "timeout" } })
    );
    const { getWeeklyActivity } = await import("@/server/weekly-activity");
    const result = await getWeeklyActivity("p1");
    expect(result.repliesThisWeek).toBe(0);
  });
});
