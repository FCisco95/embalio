import { describe, it, expect } from "vitest";
import { buildGrowthPlanPrompt } from "@/lib/growth-plan/prompt";

const input = {
  handle: "fcisco95",
  archetypeLabel: "Developer / Builder",
  voiceSpec: "Technical and concrete. Lowercase, no fluff.",
  pillars: ["AI agents", "Dev tools"],
  angle: "I ship agent infra and show the failure modes nobody talks about",
  goalNarrative: "build authority in AI agents",
  northStarTarget: "2,000 engaged followers",
  dailyReplyTarget: 5,
  targets: [
    { handle: "@swyx", reason: "AI-eng audience overlap" },
    { handle: "@hwchase17", reason: "ships agent frameworks" },
  ],
};

describe("buildGrowthPlanPrompt", () => {
  const p = buildGrowthPlanPrompt(input);

  it("includes the handle, angle, and north-star target", () => {
    expect(p).toContain("fcisco95");
    expect(p).toContain("agent infra");
    expect(p).toContain("2,000 engaged followers");
  });

  it("grounds rhythm in the daily reply target", () => {
    expect(p).toContain("5");
    expect(p.toLowerCase()).toMatch(/repl(y|ies)/);
  });

  it("passes the recommended accounts so the model writes 'why, for you' lines", () => {
    expect(p).toContain("@swyx");
    expect(p).toContain("@hwchase17");
  });

  it("forbids fabricating follower counts / multiples", () => {
    expect(p.toLowerCase()).toMatch(/do not (invent|fabricate)/);
  });

  it("asks for the GrowthPlan JSON shape (all 7 sections)", () => {
    for (const key of ["archetypeLabel", "voiceSummary", "whoToWatch", "rhythm", "northStar", "embalioDoes", "firstMoves"]) {
      expect(p).toContain(key);
    }
  });
});
