import { describe, it, expect, vi } from "vitest";

const { mockProfileSingle, mockSeedSelect } = vi.hoisted(() => {
  const mockProfileSingle = vi.fn().mockResolvedValue({
    data: { handle: "@cisco", voice_spec: "lowercase", content_pillars: ["AI"] },
    error: null,
  });
  const mockSeedSelect = vi.fn().mockResolvedValue({
    data: [{ handle: "@karpathy" }, { handle: "@simonw" }],
    error: null,
  });
  return { mockProfileSingle, mockSeedSelect };
});

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn().mockResolvedValue({
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: mockProfileSingle }),
          }),
        };
      }
      // seed_targets
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [{ handle: "@karpathy" }, { handle: "@simonw" }], error: null }),
          }),
        }),
      };
    }),
  }),
}));

vi.mock("@/lib/generate", () => ({
  generateText: vi.fn().mockResolvedValue("@karpathy posted: scaling laws hold\n@simonw posted: django 5.1 ships"),
  generateStructured: vi.fn()
    .mockResolvedValueOnce({
      data: {
        opportunities: [
          { targetHandle: "@karpathy", targetPost: "scaling laws hold", targetUrl: "", targetLikes: 200, postedAt: "May 27", reason: "cisco knows this" },
        ],
      },
    })
    .mockResolvedValueOnce({
      data: { reply: "scaling laws are about compute efficiency, not just data", skip: false },
    }),
}));

vi.mock("@/lib/handoff-reader", () => ({
  readHandoff: vi.fn().mockResolvedValue("Spine 1"),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { generateReplyQueue } from "@/server/engage";

describe("generateReplyQueue", () => {
  it("returns a ReplyQueue with at least one opportunity when handles are provided", async () => {
    const queue = await generateReplyQueue("profile-123", ["@karpathy", "@simonw"]);
    expect(queue.opportunities.length).toBeGreaterThan(0);
    expect(queue.opportunities[0].targetHandle).toBe("@karpathy");
    expect(queue.opportunities[0].reply).toContain("scaling");
  });
});
