import { describe, it, expect } from "vitest";
import { answersToInterview, needsSetup, curatedSeedHandles } from "@/lib/setup-logic";
import { EMPTY_ANSWERS, type SetupAnswers } from "@/lib/setup-steps";

const base: SetupAnswers = {
  ...EMPTY_ANSWERS,
  handle: "@fcisco95",
  accountSize: "<500",
  premium: true,
  pillars: ["AI agents", "Dev tools"],
  goal: "followers",
  capacity: "30m",
  voiceMethod: "tags",
  voiceTags: ["punchy", "lowercase"],
};

describe("answersToInterview", () => {
  it("maps pillars to niche and the goal bucket to a north-star phrase", () => {
    const iv = answersToInterview(base);
    expect(iv.niche).toBe("AI agents, Dev tools");
    expect(iv.goals).toBe("grow followers");
    expect(iv.northStarMetric).toBe("grow followers");
    expect(iv.premiumAccount).toBe(true);
  });

  it("prefers open-text goal over the bucket when provided", () => {
    const iv = answersToInterview({ ...base, goalOpen: "1k followers in 90 days" });
    expect(iv.goals).toBe("1k followers in 90 days");
  });

  it("uses voice tags as tone when method is tags", () => {
    expect(answersToInterview(base).tone).toBe("punchy, lowercase");
  });
});

describe("needsSetup", () => {
  it("true when profile is missing", () => {
    expect(needsSetup(null)).toBe(true);
  });
  it("true when voice_spec or pillars are empty", () => {
    expect(needsSetup({ voice_spec: "", content_pillars: ["x"] })).toBe(true);
    expect(needsSetup({ voice_spec: "spec", content_pillars: [] })).toBe(true);
  });
  it("false when both voice_spec and pillars are present", () => {
    expect(needsSetup({ voice_spec: "spec", content_pillars: ["AI"] })).toBe(false);
  });
});

describe("curatedSeedHandles", () => {
  it("keeps recommended minus toggled-off, adds user handles, normalizes + dedupes", () => {
    const out = curatedSeedHandles({
      recommended: ["@Alice", "@Bob", "@Carol"],
      toggledOff: ["@bob"],
      added: ["@Dave", "alice"],
    });
    expect(out).toEqual(["alice", "carol", "dave"]);
  });
});
