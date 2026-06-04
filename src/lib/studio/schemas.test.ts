import { describe, it, expect } from "vitest";
import { RankedTopic, RankedTopicList, VideoScript, TrendSignal, STUDIO_STAGES } from "./schemas";
import { AlgorithmBrief, ChannelPlaybook } from "./schemas";

describe("studio schemas", () => {
  it("parses a valid RankedTopic", () => {
    const t = RankedTopic.parse({ id: "t1", title: "I shipped a Solana app with Claude", angle: "vibe-coding on chain", score: 87, rationale: "fits niche", sourceRefs: ["https://x"] });
    expect(t.score).toBe(87);
  });
  it("rejects an out-of-range score", () => {
    expect(() => RankedTopic.parse({ id: "t1", title: "x", angle: "y", score: 140, rationale: "z" })).toThrow();
  });
  it("parses a RankedTopicList wrapper", () => {
    const list = RankedTopicList.parse({ topics: [{ id: "t1", title: "x", angle: "y", score: 10, rationale: "z" }] });
    expect(list.topics).toHaveLength(1);
  });
  it("parses a VideoScript with beats", () => {
    const s = VideoScript.parse({ title: "T", hook: "H", beats: [{ id: "b1", say: "say this", visualPrompt: "show code", estSeconds: 8 }] });
    expect(s.beats[0].visualPrompt).toBe("show code");
  });

  it("parses a beat with the new follow-along fields", () => {
    const s = VideoScript.parse({
      title: "T", hook: "H",
      beats: [{
        id: "b1", say: "open the cookbook", visualPrompt: "show cookbook",
        estSeconds: 8, do: "Click [Cookbook] → Run scan",
        fx: 'punch-zoom + freeze on "No GPU"', ost: "Docker blind spot",
        brollKeywords: ["rtx 3080", "task manager gpu"], markerLabel: "B4 punch-zoom",
      }],
    });
    expect(s.beats[0].do).toBe("Click [Cookbook] → Run scan");
    expect(s.beats[0].brollKeywords).toEqual(["rtx 3080", "task manager gpu"]);
  });

  it("still parses an old beat without the new fields (back-compat)", () => {
    const s = VideoScript.parse({
      title: "T", hook: "H",
      beats: [{ id: "b1", say: "say this", visualPrompt: "show code" }],
    });
    expect(s.beats[0].do).toBeUndefined();
    expect(s.beats[0].fx).toBeUndefined();
  });

  it("rejects more than 3 brollKeywords", () => {
    const r = VideoScript.safeParse({
      title: "T", hook: "H",
      beats: [{ id: "b1", say: "s", visualPrompt: "v", brollKeywords: ["a", "b", "c", "d"] }],
    });
    expect(r.success).toBe(false);
  });
  it("normalizes a TrendSignal", () => {
    const sig = TrendSignal.parse({ source: "hackernews", id: "1", title: "x", url: "https://x" });
    expect(sig.source).toBe("hackernews");
  });
  it("exposes the canonical stage order", () => {
    expect(STUDIO_STAGES).toEqual(["topic", "script", "record", "publish", "repurposed"]);
  });
});

describe("AlgorithmBrief", () => {
  it("accepts a well-formed brief with sources", () => {
    const r = AlgorithmBrief.safeParse({
      packaging: ["Front-load the payoff in the title"],
      retention: ["Hook must pay off in the first 15s"],
      formats: ["build-in-public logs"],
      cadence: "2 long-form + 4 shorts / week",
      authenticity: ["Keep a real face in the flagship loop"],
      summary: "Current YT best practices for solo devs.",
      sources: [{ title: "Creator Insider", url: "https://youtube.com/x" }],
    });
    expect(r.success).toBe(true);
  });
  it("rejects an empty packaging list", () => {
    const r = AlgorithmBrief.safeParse({
      packaging: [], retention: ["x"], formats: [], cadence: "c",
      authenticity: [], summary: "s", sources: [],
    });
    expect(r.success).toBe(false);
  });
});

describe("ChannelPlaybook", () => {
  it("accepts a well-formed playbook", () => {
    const r = ChannelPlaybook.safeParse({
      positioning: "A vibe-coder who builds on blockchain in public",
      northStar: { devBrand: "1k subs in 90d", organic: "ship Organic on-chain weekly" },
      pillars: [{ name: "Build logs", why: "Trust via the messy middle" }],
      packagingFormulas: ["I built X with Y in Z time"],
      retentionRules: ["Pay off the hook in 15s"],
      cadence: "2 long-form / week",
      nextMoves: ["Record the smart-contract teardown"],
    });
    expect(r.success).toBe(true);
  });
  it("rejects more than 6 pillars", () => {
    const pillars = Array.from({ length: 7 }, (_, i) => ({ name: `p${i}`, why: "w" }));
    const r = ChannelPlaybook.safeParse({
      positioning: "p", northStar: { devBrand: "d", organic: "o" }, pillars,
      packagingFormulas: ["f"], retentionRules: ["r"], cadence: "c", nextMoves: ["m"],
    });
    expect(r.success).toBe(false);
  });
});
