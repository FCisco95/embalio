import { describe, it, expect } from "vitest";
import { answersToInterview, needsSetup, curatedSeedHandles, stepComplete } from "@/lib/setup-logic";
import { EMPTY_ANSWERS, STEPS, type SetupAnswers } from "@/lib/setup-steps";

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

const stepById = (id: string) => STEPS.find((s) => s.id === id)!;

describe("stepComplete", () => {
  it("optional steps are always complete", () => {
    expect(stepComplete(stepById("motive"), EMPTY_ANSWERS)).toBe(true);
  });

  it("a required single is incomplete until chosen", () => {
    expect(stepComplete(stepById("archetype"), EMPTY_ANSWERS)).toBe(false);
    expect(stepComplete(stepById("archetype"), { ...EMPTY_ANSWERS, archetype: "dev" })).toBe(true);
  });

  it("a required chips field needs at least one selection", () => {
    expect(stepComplete(stepById("pillars"), EMPTY_ANSWERS)).toBe(false);
    expect(stepComplete(stepById("pillars"), { ...EMPTY_ANSWERS, pillars: ["AI agents"] })).toBe(true);
  });

  it("goal is complete when an option is selected", () => {
    expect(stepComplete(stepById("goal"), { ...EMPTY_ANSWERS, goal: "reach" })).toBe(true);
  });

  it("GOAL_OPEN FIX: goal is complete when only the open-text is typed", () => {
    expect(stepComplete(stepById("goal"), { ...EMPTY_ANSWERS, goal: "", goalOpen: "launch a paid course" })).toBe(true);
  });

  it("goal is incomplete when neither option nor open-text is set", () => {
    expect(stepComplete(stepById("goal"), { ...EMPTY_ANSWERS, goal: "", goalOpen: "  " })).toBe(false);
  });

  it("a required toggle (premium) counts as complete (default is a real answer)", () => {
    expect(stepComplete(stepById("premium"), EMPTY_ANSWERS)).toBe(true);
  });
});
