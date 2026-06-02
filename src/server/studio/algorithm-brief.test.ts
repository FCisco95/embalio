import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AlgorithmBrief } from "@/lib/studio/schemas";

vi.mock("@/lib/supabase/server", () => ({ supabaseService: vi.fn() }));

const BRIEF: AlgorithmBrief = {
  packaging: ["p"], retention: ["r"], formats: [], cadence: "c",
  authenticity: [], summary: "s", sources: [],
};

function mockDb(latestRow: unknown, inserted: unknown = { id: "new" }) {
  const insert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: inserted, error: null }) }),
  });
  const from = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: latestRow, error: null }),
          }),
        }),
      }),
    }),
    insert,
  });
  return { from, insert };
}

describe("runAlgorithmBrief", () => {
  beforeEach(() => vi.resetModules());

  it("returns the cached brief without researching when fresh", async () => {
    const { supabaseService } = await import("@/lib/supabase/server");
    const { from } = mockDb({ brief: BRIEF, researched_at: "2026-06-01T00:00:00Z" });
    vi.mocked(supabaseService).mockReturnValue({ from } as never);
    const { runAlgorithmBrief } = await import("./algorithm-brief");
    const research = vi.fn();
    const r = await runAlgorithmBrief("pid", research, { freshnessDays: 7, now: new Date("2026-06-05T00:00:00Z") });
    expect(research).not.toHaveBeenCalled();
    expect(r.brief).toEqual(BRIEF);
    expect(r.stale).toBe(false);
  });

  it("researches and inserts when the cache is stale", async () => {
    const { supabaseService } = await import("@/lib/supabase/server");
    const { from, insert } = mockDb({ brief: BRIEF, researched_at: "2026-05-01T00:00:00Z" });
    vi.mocked(supabaseService).mockReturnValue({ from } as never);
    const { runAlgorithmBrief } = await import("./algorithm-brief");
    const fresh: AlgorithmBrief = { ...BRIEF, summary: "fresh" };
    const research = vi.fn().mockResolvedValue(fresh);
    const r = await runAlgorithmBrief("pid", research, { freshnessDays: 7, now: new Date("2026-06-05T00:00:00Z") });
    expect(research).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalled();
    expect(r.brief).toEqual(fresh);
  });

  it("falls back to the stale cached brief when research throws", async () => {
    const { supabaseService } = await import("@/lib/supabase/server");
    const { from } = mockDb({ brief: BRIEF, researched_at: "2026-05-01T00:00:00Z" });
    vi.mocked(supabaseService).mockReturnValue({ from } as never);
    const { runAlgorithmBrief } = await import("./algorithm-brief");
    const research = vi.fn().mockRejectedValue(new Error("web research down"));
    const r = await runAlgorithmBrief("pid", research, { freshnessDays: 7, now: new Date("2026-06-05T00:00:00Z") });
    expect(r.brief).toEqual(BRIEF);
    expect(r.stale).toBe(true);
  });

  it("rethrows when research fails and there is no cached brief", async () => {
    const { supabaseService } = await import("@/lib/supabase/server");
    const { from } = mockDb(null);
    vi.mocked(supabaseService).mockReturnValue({ from } as never);
    const { runAlgorithmBrief } = await import("./algorithm-brief");
    const research = vi.fn().mockRejectedValue(new Error("down"));
    await expect(runAlgorithmBrief("pid", research, { now: new Date() })).rejects.toThrow("down");
  });

  it("returns the fresh brief (not stale) when research succeeds but the cache insert fails", async () => {
    const { supabaseService } = await import("@/lib/supabase/server");
    // Build a db mock whose insert resolves with an error.
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: { message: "insert boom" } }) }),
    });
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { brief: BRIEF, researched_at: "2026-05-01T00:00:00Z" }, error: null }),
            }),
          }),
        }),
      }),
      insert,
    });
    vi.mocked(supabaseService).mockReturnValue({ from } as never);
    const { runAlgorithmBrief } = await import("./algorithm-brief");
    const fresh = { ...BRIEF, summary: "fresh-after-insert-fail" };
    const research = vi.fn().mockResolvedValue(fresh);
    const r = await runAlgorithmBrief("pid", research, { freshnessDays: 7, now: new Date("2026-06-05T00:00:00Z") });
    expect(research).toHaveBeenCalledTimes(1);
    expect(r.brief).toEqual(fresh);
    expect(r.stale).toBe(false);
  });
});
