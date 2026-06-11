import { describe, it, expect } from "vitest";
import { buildTopicBoardPrompt, type WarehouseTweetLine } from "@/lib/voice-prompt";

const tweets: WarehouseTweetLine[] = [
  { handle: "levelsio", text: "shipped an agent that books my flights", url: "https://x.com/levelsio/status/9", createdAt: "2026-06-11T06:00:00Z" },
];

describe("buildTopicBoardPrompt", () => {
  it("embeds pillars, date, and warehouse tweets", () => {
    const p = buildTopicBoardPrompt(["AI tooling", "build in public"], "June 11, 2026", tweets);
    expect(p).toContain("AI tooling");
    expect(p).toContain("June 11, 2026");
    expect(p).toContain("@levelsio");
    expect(p).toContain("books my flights");
  });
  it("asks for the TopicBoardReport JSON shape with dated sources", () => {
    const p = buildTopicBoardPrompt(["x"], "d", []);
    expect(p).toContain('"published_at"');
    expect(p).toContain('"kind"');
    expect(p).toMatch(/spike.*durable|durable.*spike/);
  });
  it("omits the warehouse section when no tweets", () => {
    expect(buildTopicBoardPrompt(["x"], "d", [])).not.toContain("signal warehouse");
  });
  it("truncates long tweet text", () => {
    const long = { ...tweets[0], text: "z".repeat(500) };
    expect(buildTopicBoardPrompt(["x"], "d", [long])).not.toContain("z".repeat(250));
  });
});
