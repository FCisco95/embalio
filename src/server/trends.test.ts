import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock every collaborator generateTrendRadar pulls in, plus the gate it composes.
// This isolates gatedTrendRadar to its one job: scan -> hand the scanned trends
// to gateTrends -> return only the keepers it gives back.
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: vi.fn() }));
vi.mock("@/lib/generate", () => ({ generateStructured: vi.fn() }));
vi.mock("@/lib/voice-prompt", () => ({ buildTrendRadarPrompt: vi.fn(() => "p") }));
vi.mock("@/server/credibility", () => ({ gateTrends: vi.fn() }));
vi.mock("@/server/original", () => ({ composeOriginalForProfile: vi.fn() }));

describe("gatedTrendRadar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("scans trends then returns only the gated keepers", async () => {
    const { generateStructured } = await import("@/lib/generate");
    const { supabaseServer } = await import("@/lib/supabase/server");
    const { gateTrends } = await import("@/server/credibility");

    (supabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({ single: async () => ({ data: { content_pillars: ["ai"] }, error: null }) }),
        }),
      }),
    });

    const scanned = { topic: "t1", why_now: "w", angle: "a", source: "s" };
    // generateStructured returns the TrendReport directly under `data`.
    (generateStructured as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { trends: [scanned], generatedAt: "now" },
    });
    (gateTrends as ReturnType<typeof vi.fn>).mockResolvedValue([
      { trend: scanned, angle: "sharp angle", reason: "on-niche" },
    ]);

    const { gatedTrendRadar } = await import("@/server/trends");
    const out = await gatedTrendRadar("p1");

    // (a) returns only the keepers gateTrends handed back
    expect(out).toHaveLength(1);
    expect(out[0].angle).toBe("sharp angle");
    expect(out[0].reason).toBe("on-niche");
    // (b) gateTrends was called with the profile id and the scanned trends
    expect(gateTrends).toHaveBeenCalledWith("p1", [scanned]);
  });

  it("returns an empty list when nothing survives the gate", async () => {
    const { generateStructured } = await import("@/lib/generate");
    const { supabaseServer } = await import("@/lib/supabase/server");
    const { gateTrends } = await import("@/server/credibility");

    (supabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({ single: async () => ({ data: { content_pillars: ["ai"] }, error: null }) }),
        }),
      }),
    });
    (generateStructured as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { trends: [{ topic: "t1", why_now: "w", angle: "a" }], generatedAt: "now" },
    });
    (gateTrends as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { gatedTrendRadar } = await import("@/server/trends");
    const out = await gatedTrendRadar("p1");

    expect(out).toEqual([]);
    expect(gateTrends).toHaveBeenCalledTimes(1);
  });
});

describe("draftFromTrend", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps a gated trend to a news-insight angle and composes the draft", async () => {
    const { composeOriginalForProfile } = await import("@/server/original");
    (composeOriginalForProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
      draft: { posts: ["voiced"], suggestedVisual: undefined },
      saved: { id: "d1" },
    });

    const gated = {
      trend: { topic: "t1", why_now: "w", angle: "a", source: "https://x.com/s" },
      angle: "sharp take",
      reason: "on-niche",
    };

    const { draftFromTrend } = await import("@/server/trends");
    const out = await draftFromTrend("p1", gated);

    // gated.angle becomes the hook; mode is news-insight; source carries through.
    expect(composeOriginalForProfile).toHaveBeenCalledWith("p1", {
      mode: "news-insight",
      hook: "sharp take",
      source: "https://x.com/s",
    });
    // returns whatever composeOriginalForProfile returns
    expect(out).toEqual({ draft: { posts: ["voiced"], suggestedVisual: undefined }, saved: { id: "d1" } });
  });
});
