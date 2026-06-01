import { describe, it, expect } from "vitest";
import { buildEngagementPostPrompt } from "@/lib/engagement/post-craft";
import type { EngagementKnobs } from "@/lib/engagement/knobs";

const knobs: EngagementKnobs = { goal: "reach", ownerFollowerEstimate: 2750, targetFollowerBand: { min: 13750, max: 55000 }, dailyReplyTarget: 12, replyPlaybook: "" };

describe("buildEngagementPostPrompt", () => {
  const p = buildEngagementPostPrompt("VOICE", { hook: "agents fail on recovery", source: "" }, knobs);
  it("includes the voice system", () => expect(p).toContain("VOICE"));
  it("optimizes for replies/bookmarks, not likes", () => expect(p.toLowerCase()).toMatch(/reply|bookmark/));
  it("enforces link-in-reply (no link in body)", () => expect(p.toLowerCase()).toContain("link"));
  it("demands a first-line hook", () => expect(p.toLowerCase()).toMatch(/first line|hook/));
  it("asks for the OriginalDraft JSON shape", () => expect(p).toMatch(/"posts"/));

  it("injects the source with a link-in-reply instruction", () => {
    const ps = buildEngagementPostPrompt("VOICE", { hook: "agents fail on recovery", source: "https://example.com/post" }, knobs);
    expect(ps).toContain("https://example.com/post");
    expect(ps).toMatch(/url in a reply/i);
  });

  it("emits a goal-emphasis line for reach goal", () => {
    const pr = buildEngagementPostPrompt("VOICE", { hook: "agents fail on recovery", source: "" }, knobs);
    expect(pr.toLowerCase()).toMatch(/repost|bookmark/);
  });
});
