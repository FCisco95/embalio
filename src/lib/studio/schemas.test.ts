import { describe, it, expect } from "vitest";
import { RankedTopic, RankedTopicList, VideoScript, TrendSignal, STUDIO_STAGES } from "./schemas";

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
  it("normalizes a TrendSignal", () => {
    const sig = TrendSignal.parse({ source: "hackernews", id: "1", title: "x", url: "https://x" });
    expect(sig.source).toBe("hackernews");
  });
  it("exposes the canonical stage order", () => {
    expect(STUDIO_STAGES).toEqual(["topic", "script", "record", "publish", "repurposed"]);
  });
});
