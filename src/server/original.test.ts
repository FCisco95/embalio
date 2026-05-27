import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSingle = vi.hoisted(() => vi.fn().mockResolvedValue({
  data: { handle: "@cisco", voice_spec: "lowercase", content_pillars: ["AI"] },
  error: null,
}));
const mockEq = vi.hoisted(() => vi.fn().mockReturnValue({ single: mockSingle }));
const mockSelect = vi.hoisted(() => vi.fn().mockReturnValue({ eq: mockEq }));
const mockFrom = vi.hoisted(() => vi.fn().mockReturnValue({ select: mockSelect }));

vi.mock("@/lib/generate", () => ({
  generateStructured: vi.fn(),
  generateText: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn().mockResolvedValue({ from: mockFrom }),
}));

vi.mock("@/lib/handoff-reader", () => ({
  readHandoff: vi.fn().mockResolvedValue("Spine 1 was built"),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { generateStructured, generateText } from "@/lib/generate";
import { proposeAnglesForPillars, draftFromAngle, generateWeeklyPosts } from "@/server/original";

beforeEach(() => {
  vi.clearAllMocks();
  // Re-apply default supabase chain mock after clearAllMocks
  mockSingle.mockResolvedValue({
    data: { handle: "@cisco", voice_spec: "lowercase", content_pillars: ["AI"] },
    error: null,
  });
  mockEq.mockReturnValue({ single: mockSingle });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });
});

describe("original post engine", () => {
  it("proposeAnglesForPillars returns researched angles", async () => {
    vi.mocked(generateStructured).mockResolvedValueOnce({ data: { angles: [{ mode: "news-insight", hook: "rollups", source: "https://x" }] } });
    const angles = await proposeAnglesForPillars(["AI", "agents"]);
    expect(angles[0].mode).toBe("news-insight");
    expect(angles[0].hook).toBe("rollups");
  });
  it("draftFromAngle returns a thread of posts", async () => {
    vi.mocked(generateStructured).mockResolvedValueOnce({ data: { posts: ["rollups are underrated"], suggestedVisual: "diagram" } });
    const d = await draftFromAngle("@cisco voice", { mode: "news-insight", hook: "rollups" });
    expect(d.posts[0]).toContain("rollups");
  });
});

describe("generateWeeklyPosts", () => {
  it("returns a WeeklyPostPlan with at least one post", async () => {
    vi.mocked(generateText).mockResolvedValue("some research text");
    vi.mocked(generateStructured)
      .mockResolvedValueOnce({
        data: {
          angles: [
            { format: "quick-take", hook: "vitest is fast", connection: "cisco uses vitest" },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: { posts: ["vitest is faster than jest"], suggestedVisual: undefined },
      });

    const plan = await generateWeeklyPosts("profile-123");
    expect(plan.posts.length).toBeGreaterThan(0);
    expect(plan.posts[0].format).toBe("quick-take");
    expect(plan.posts[0].posts[0]).toContain("vitest");
  });
});
