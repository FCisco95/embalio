import { describe, it, expect, vi, beforeEach } from "vitest";

const postsResult = { data: [] as Array<Record<string, unknown>> };
const candsResult = { data: [] as Array<Record<string, unknown>> };
const profileResult = { data: { growth_plan: null } as Record<string, unknown> | null };

function makeFrom() {
  return (table: string) => {
    if (table === "posts") {
      return { select: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve(postsResult) }) }) }) };
    }
    if (table === "candidates") {
      return { select: () => ({ eq: () => ({ eq: () => Promise.resolve(candsResult) }) }) };
    }
    return { select: () => ({ eq: () => ({ single: () => Promise.resolve(profileResult) }) }) };
  };
}
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: async () => ({ from: makeFrom() }) }));

const findHotTopics = vi.fn();
const gateTrends = vi.fn();
vi.mock("@/server/create-post", () => ({ findHotTopics: (...a: unknown[]) => findHotTopics(...a) }));
vi.mock("@/server/credibility", () => ({ gateTrends: (...a: unknown[]) => gateTrends(...a) }));

import { getDailyAssignment } from "@/server/coach";

const todayIso = new Date().toISOString();

describe("getDailyAssignment", () => {
  beforeEach(() => {
    postsResult.data = [];
    candsResult.data = [];
    profileResult.data = { growth_plan: { rhythm: [{ count: "5", label: "strategic replies/day" }] } };
    findHotTopics.mockReset();
    gateTrends.mockReset();
  });

  it("assigns a POST with a gated angle when nothing posted today", async () => {
    findHotTopics.mockResolvedValue([{ topic: "t", why_now: "w", angle: "a", source: "https://x.com/1" }]);
    gateTrends.mockResolvedValue([{ trend: { topic: "t", why_now: "w", angle: "a", source: "https://x.com/1" }, angle: "sharp take", reason: "fits" }]);
    const a = await getDailyAssignment("p1");
    expect(a.kind).toBe("post");
    expect(a.angle?.hook).toBe("sharp take");
  });

  it("assigns REPLIES when an original is already posted today", async () => {
    postsResult.data = [{ posted_at: todayIso, drafts: { kind: "original" } }];
    const a = await getDailyAssignment("p1");
    expect(a.kind).toBe("reply");
    expect(findHotTopics).not.toHaveBeenCalled();
  });

  it("still assigns a POST (no angle) when the research/gate call throws", async () => {
    findHotTopics.mockRejectedValue(new Error("research timeout"));
    const a = await getDailyAssignment("p1");
    expect(a.kind).toBe("post");
    expect(a.angle).toBeUndefined();
    expect(a.nextAction.toLowerCase()).toContain("trend");
  });
});

// Home-page latency: getDailyAssignment's only production caller is
// getDailyPlan on `/`. Running live trend research there put two LLM calls on
// the request path. See docs/GOAL-LOG.md O4.
describe("getDailyAssignment — liveTrends opt-out", () => {
  beforeEach(() => {
    findHotTopics.mockReset();
    gateTrends.mockReset();
    postsResult.data = [];
    candsResult.data = [];
  });

  it("does no trend research when liveTrends is false", async () => {
    await getDailyAssignment("p1", { liveTrends: false });
    expect(findHotTopics).not.toHaveBeenCalled();
    expect(gateTrends).not.toHaveBeenCalled();
  });

  it("uses a caller-supplied angle instead of researching one", async () => {
    const a = await getDailyAssignment("p1", {
      liveTrends: false,
      topAngle: { hook: "durable nonces are the real story", source: "https://x.com/1" },
    });
    expect(JSON.stringify(a)).toContain("durable nonces");
    expect(findHotTopics).not.toHaveBeenCalled();
  });

  it("still researches by default, so other callers are unaffected", async () => {
    findHotTopics.mockResolvedValue([]);
    gateTrends.mockResolvedValue([]);
    await getDailyAssignment("p1");
    expect(findHotTopics).toHaveBeenCalled();
  });
});
