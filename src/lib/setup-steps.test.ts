import { describe, it, expect } from "vitest";
import { STEPS, CHAPTERS, activeSteps, EMPTY_ANSWERS, type Archetype } from "@/lib/setup-steps";

describe("step config integrity", () => {
  it("every step belongs to a known chapter", () => {
    const ids = new Set(CHAPTERS.map((c) => c.id));
    for (const s of STEPS) expect(ids.has(s.chapter)).toBe(true);
  });

  it("has the keystone archetype step first and required", () => {
    expect(STEPS[0].id).toBe("archetype");
    expect(STEPS[0].required).toBe(true);
  });

  it("EMPTY_ANSWERS has every required array field initialized", () => {
    expect(EMPTY_ANSWERS.pillars).toEqual([]);
    expect(EMPTY_ANSWERS.platforms).toEqual([]);
    expect(EMPTY_ANSWERS.formats).toEqual([]);
    expect(EMPTY_ANSWERS.inspirations).toEqual([]);
    expect(EMPTY_ANSWERS.archetype).toBe("");
  });
});

describe("activeSteps — structural archetype branching", () => {
  it("shows only the matching archetype-specific detail step", () => {
    const dev = activeSteps("dev").map((s) => s.id);
    expect(dev).toContain("archetypeDetail");
    const detailSteps = activeSteps("dev").filter((s) => s.id === "archetypeDetail");
    expect(detailSteps).toHaveLength(1);
    expect(detailSteps[0].showFor).toContain("dev");
  });

  it("a founder sees a different archetypeDetail step than a dev", () => {
    const devDetail = activeSteps("dev").find((s) => s.id === "archetypeDetail");
    const founderDetail = activeSteps("founder").find((s) => s.id === "archetypeDetail");
    expect(devDetail?.question).not.toBe(founderDetail?.question);
  });

  it("an unset archetype hides all archetype-specific steps", () => {
    const none = activeSteps("").map((s) => s.id);
    expect(none).not.toContain("archetypeDetail");
  });

  it("Core (non-optional) steps are identical across archetypes", () => {
    const core = (a: Archetype | "") => activeSteps(a).filter((s) => s.required && !s.optional).map((s) => s.id);
    expect(core("dev")).toEqual(core("founder"));
  });
});
