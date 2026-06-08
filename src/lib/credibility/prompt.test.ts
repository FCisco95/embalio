import { describe, it, expect } from "vitest";
import { buildCredibilityPrompt } from "@/lib/credibility/prompt";
import type { Trend } from "@/lib/schemas";

const trend: Trend = {
  topic: "New AI agent framework launched",
  why_now: "trending on X today",
  angle: "everyone's hyping it",
  source: "https://x.com/foo/status/1",
};

describe("buildCredibilityPrompt", () => {
  it("includes the pillars, niche, and the trend topic", () => {
    const p = buildCredibilityPrompt(["build-in-public", "AI growth-hacking"], "solo dev building in public", trend);
    expect(p).toContain("build-in-public");
    expect(p).toContain("solo dev building in public");
    expect(p).toContain("New AI agent framework launched");
  });

  it("asks for the keep/angle/reason shape", () => {
    const p = buildCredibilityPrompt(["x"], "y", trend);
    expect(p.toLowerCase()).toContain("keep");
    expect(p.toLowerCase()).toContain("angle");
  });
});
