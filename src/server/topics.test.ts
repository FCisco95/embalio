import { describe, it, expect, vi, beforeEach } from "vitest";

const dispatchTopicRefresh = vi.fn(async () => true);
vi.mock("@/lib/topics/dispatch", () => ({ dispatchTopicRefresh: () => dispatchTopicRefresh() }));

const draftFromTrend = vi.fn(async () => ({}));
vi.mock("@/server/trends", () => ({ draftFromTrend: (...a: unknown[]) => draftFromTrend(...a) }));

let topicRows: unknown[] = [];
let staleRows: unknown[] = [];
let briefing: unknown = null;
let draftRow: unknown = null;
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    from: (table: string) => {
      if (table === "topic_history")
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: () => ({
                  order: async () => ({ data: topicRows, error: null }),
                }),
                single: async () =>
                  draftRow
                    ? { data: draftRow, error: null }
                    : { data: null, error: new Error("not found") },
              }),
              gte: () => ({
                order: async () => ({ data: staleRows, error: null }),
              }),
            }),
          }),
        };
      if (table === "research_briefings")
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: briefing, error: null }) }) }) }) };
      throw new Error(`unexpected ${table}`);
    },
  }),
}));

import { getTopicBoard, draftFromTopicRow } from "./topics";

const now = Date.now();
const iso = (minAgo: number) => new Date(now - minAgo * 60_000).toISOString();
const row = (minAgo: number) => ({
  id: "t1", profile_id: "p", topic: "Agent SDK", angle: "a", score: 80,
  why: { niche_fit: 30, heat: 25, credibility: 20, timing: 15, window: "react", kind: "spike", why_now: "w", reason: "r" },
  sources: [{ url: "https://x.com/a/1", title: "s", published_at: iso(minAgo) }],
  generated_at: iso(minAgo), expires_at: iso(minAgo - 120), status: "fresh",
});

beforeEach(() => { topicRows = []; staleRows = []; briefing = null; draftRow = null; dispatchTopicRefresh.mockClear(); draftFromTrend.mockClear(); });

describe("getTopicBoard", () => {
  it("fresh board (<60min): state fresh, no background dispatch", async () => {
    topicRows = [row(20)];
    const v = await getTopicBoard("p");
    expect(v.state).toBe("fresh");
    expect(v.topics).toHaveLength(1);
    expect(dispatchTopicRefresh).not.toHaveBeenCalled();
  });
  it("cached board (60-120min): state cached + background dispatch fired", async () => {
    topicRows = [row(90)];
    const v = await getTopicBoard("p");
    expect(v.state).toBe("cached");
    expect(dispatchTopicRefresh).toHaveBeenCalledOnce();
  });
  it("drops rows without generated_at — no timestamp, no render", async () => {
    topicRows = [{ ...row(20), generated_at: null }, row(25)];
    const v = await getTopicBoard("p");
    expect(v.topics).toHaveLength(1);
  });
  it("no fresh rows + today's briefing → state briefing", async () => {
    briefing = { topics: [{ topic: "from briefing" }], date: "2026-06-11" };
    const v = await getTopicBoard("p");
    expect(v.state).toBe("briefing");
    expect(v.topics[0].topic).toBe("from briefing");
  });
  it("no fresh, no briefing, ≤48h-old board → state stale", async () => {
    staleRows = [{ ...row(60 * 20), status: "expired" }];
    const v = await getTopicBoard("p");
    expect(v.state).toBe("stale");
    expect(v.topics).toHaveLength(1);
  });
  it("nothing anywhere → labeled empty, never throws", async () => {
    const v = await getTopicBoard("p");
    expect(v.state).toBe("empty");
    expect(v.topics).toHaveLength(0);
  });
});

describe("draftFromTopicRow", () => {
  it("throws when topic id not found for profile", async () => {
    draftRow = null;
    await expect(draftFromTopicRow("p", "missing-id")).rejects.toThrow(/topic not found/);
  });
  it("re-reads row server-side and routes through draftFromTrend", async () => {
    draftRow = {
      id: "t1", profile_id: "p", topic: "Agent SDK", angle: "my angle",
      why: { why_now: "released", reason: "you ship" },
      sources: [{ url: "https://x.com/a/1", title: "s", published_at: "2026-06-11" }],
    };
    await draftFromTopicRow("p", "t1");
    expect(draftFromTrend).toHaveBeenCalledWith("p", {
      trend: { topic: "Agent SDK", why_now: "released", angle: "my angle", source: "https://x.com/a/1" },
      angle: "my angle",
      reason: "you ship",
    });
  });
});
