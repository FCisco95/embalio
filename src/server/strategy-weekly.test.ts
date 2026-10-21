import { describe, it, expect, vi } from "vitest";

const assertOwnProfile = vi.fn<(id: string) => Promise<void>>();
vi.mock("@/server/auth", () => ({ assertOwnProfile: (id: string) => assertOwnProfile(id) }));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => { throw new Error("supabaseServer used without a session"); },
  supabaseService: () => { throw new Error("db down"); },
}));

import { runWeeklyStrategy } from "./strategy-weekly";

describe("runWeeklyStrategy", () => {
  it("never asks for a session — /api/cron/strategy has none", async () => {
    const r = await runWeeklyStrategy("p1");
    expect(assertOwnProfile).not.toHaveBeenCalled();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("db down");
  });
});
