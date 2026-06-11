import { describe, it, expect } from "vitest";
import { buildEngagementReplyPrompt } from "@/lib/engagement/reply-craft";
import type { EngagementKnobs } from "@/lib/engagement/knobs";

const knobs: EngagementKnobs = {
  goal: "leads",
  ownerFollowerEstimate: 2750,
  targetFollowerBand: { min: 5500, max: 27500 },
  dailyReplyTarget: 12,
  replyPlaybook: "never reply to drama",
};

const target = { authorHandle: "@naval", post: "shipping fast beats planning", reason: "rising, in-niche" };

describe("buildEngagementReplyPrompt", () => {
  const p = buildEngagementReplyPrompt("VOICE_SYSTEM", target, knobs);

  it("states the author-reply-back objective", () => {
    expect(p).toMatch(/reply back/i);
  });
  it("defines all five scenario recipes", () => {
    for (const s of ["supportive", "contrarian", "witty", "technical", "question"]) {
      expect(p.toLowerCase()).toContain(s);
    }
  });
  it("bans slop openers explicitly", () => {
    expect(p.toLowerCase()).toContain("great post");
    expect(p.toLowerCase()).toContain("never");
  });
  it("includes the voice system and the owner's playbook", () => {
    expect(p).toContain("VOICE_SYSTEM");
    expect(p).toContain("never reply to drama");
  });
  it("tunes by goal", () => {
    expect(p.toLowerCase()).toContain("leads");
  });
  it("asks for JSON with reply + scenario + skip", () => {
    expect(p).toMatch(/"scenario"/);
    expect(p).toMatch(/"skip"/);
  });
});
