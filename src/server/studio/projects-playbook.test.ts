import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ supabaseService: vi.fn() }));
vi.mock("@/lib/studio/signals", () => ({ collectTrendSignals: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/voice-prompt", () => ({ buildVoiceSystemFromSpec: () => "voice" }));
vi.mock("@/lib/retry", () => ({ withRetry: (fn: () => unknown) => fn() }));
const rankTopics = vi.fn().mockResolvedValue([]);
vi.mock("@/lib/studio/brain", () => ({ brain: { rankTopics, writeScript: vi.fn() } }));
describe("rankTopicsForProject", () => {
  beforeEach(() => vi.resetModules());
  it("passes the loaded playbook into brain.rankTopics", async () => {
    const playbook = {
      positioning: "p", northStar: { devBrand: "d", organic: "o" },
      pillars: [{ name: "n", why: "w" }], packagingFormulas: ["f"],
      retentionRules: ["r"], cadence: "c", nextMoves: ["m"],
    };
    const { supabaseService } = await import("@/lib/supabase/server");
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "pid", niche_description: "n", channel_playbook: playbook } }) }) }),
    });
    vi.mocked(supabaseService).mockReturnValue({ from } as never);
    const { rankTopicsForProject } = await import("./projects");
    await rankTopicsForProject("pid");
    expect(rankTopics).toHaveBeenCalledWith(expect.objectContaining({ playbook: expect.objectContaining({ positioning: "p" }) }));
  });
});
