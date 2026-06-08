import { describe, it, expect, vi, beforeEach } from "vitest";

const single = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
  }),
}));
const gateTrend = vi.fn();
vi.mock("@/lib/credibility/gate", () => ({ gateTrend: (...a: unknown[]) => gateTrend(...a) }));

import { gateTrends } from "@/server/credibility";
import type { Trend } from "@/lib/schemas";

const trends: Trend[] = [
  { topic: "keep-me", why_now: "w", angle: "a1" },
  { topic: "drop-me", why_now: "w", angle: "a2" },
];

describe("gateTrends", () => {
  beforeEach(() => { single.mockReset(); gateTrend.mockReset(); });

  it("returns only kept trends with their angle", async () => {
    single.mockResolvedValue({ data: { content_pillars: ["p"], niche_description: "n" } });
    gateTrend
      .mockResolvedValueOnce({ keep: true, angle: "sharp take", reason: "fits" })
      .mockResolvedValueOnce({ keep: false, angle: "", reason: "off niche" });
    const out = await gateTrends("profile-1", trends);
    expect(out).toHaveLength(1);
    expect(out[0].trend.topic).toBe("keep-me");
    expect(out[0].angle).toBe("sharp take");
  });

  it("throws when the profile is missing", async () => {
    single.mockResolvedValue({ data: null });
    await expect(gateTrends("nope", trends)).rejects.toThrow(/profile/i);
  });
});
