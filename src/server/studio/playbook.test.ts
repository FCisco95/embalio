import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChannelPlaybook } from "@/lib/studio/schemas";

vi.mock("@/lib/supabase/server", () => ({ supabaseService: vi.fn(), supabaseServer: vi.fn() }));
vi.mock("@/lib/generate", () => ({ generateStructured: vi.fn() }));
vi.mock("./algorithm-brief", () => ({ runAlgorithmBrief: vi.fn(), getAlgorithmBrief: vi.fn() }));
vi.mock("@/lib/voice-prompt", () => ({ buildVoiceSystemFromSpec: () => "voice" }));

const PLAYBOOK: ChannelPlaybook = {
  positioning: "p", northStar: { devBrand: "d", organic: "o" },
  pillars: [{ name: "n", why: "w" }], packagingFormulas: ["f"],
  retentionRules: ["r"], cadence: "c", nextMoves: ["m"],
};

describe("generateChannelPlaybook", () => {
  beforeEach(() => vi.resetModules());

  it("researches the brief, synthesizes, persists, and returns the playbook", async () => {
    const { supabaseService } = await import("@/lib/supabase/server");
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "pid", niche_description: "vibe" }, error: null }) }),
      }),
      update,
    });
    vi.mocked(supabaseService).mockReturnValue({ from } as never);

    const { runAlgorithmBrief } = await import("./algorithm-brief");
    vi.mocked(runAlgorithmBrief).mockResolvedValue({
      brief: { packaging: ["p"], retention: ["r"], formats: [], cadence: "c", authenticity: [], summary: "s", sources: [] },
      researched_at: "2026-06-05T00:00:00Z", stale: false,
    });
    const { generateStructured } = await import("@/lib/generate");
    vi.mocked(generateStructured).mockResolvedValue({ data: PLAYBOOK } as never);

    const { generateChannelPlaybook } = await import("./playbook");
    const result = await generateChannelPlaybook("pid");
    expect(result.positioning).toBe("p");
    expect(result.briefResearchedAt).toBe("2026-06-05T00:00:00Z");
    expect(update).toHaveBeenCalled();
  });

  it("throws and does not persist when synthesis returns no data", async () => {
    const { supabaseService } = await import("@/lib/supabase/server");
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "pid", niche_description: "vibe" }, error: null }) }),
      }),
      update,
    });
    vi.mocked(supabaseService).mockReturnValue({ from } as never);
    const { runAlgorithmBrief } = await import("./algorithm-brief");
    vi.mocked(runAlgorithmBrief).mockResolvedValue({
      brief: { packaging: ["p"], retention: ["r"], formats: [], cadence: "c", authenticity: [], summary: "s", sources: [] },
      researched_at: "2026-06-05T00:00:00Z", stale: false,
    });
    const { generateStructured } = await import("@/lib/generate");
    vi.mocked(generateStructured).mockResolvedValue({ data: null, raw: "" } as never);

    const { generateChannelPlaybook } = await import("./playbook");
    await expect(generateChannelPlaybook("pid")).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });
});
