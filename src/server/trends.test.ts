import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock every collaborator generateTrendRadar pulls in, plus the gate it composes.
// This isolates gatedTrendRadar to its one job: scan -> hand the scanned trends
// to gateTrends -> return only the keepers it gives back.
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: vi.fn() }));
vi.mock("@/lib/generate", () => ({ generateStructured: vi.fn() }));
vi.mock("@/lib/voice-prompt", () => ({ buildTrendRadarPrompt: vi.fn(() => "p") }));
vi.mock("@/server/credibility", () => ({ gateTrends: vi.fn() }));

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
