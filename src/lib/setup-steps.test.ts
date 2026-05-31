import { describe, it, expect } from "vitest";
import { STEPS, type StepDef } from "@/lib/setup-steps";

describe("STEPS config", () => {
  it("has the 7 expected step ids in order", () => {
    expect(STEPS.map((s) => s.id)).toEqual([
      "handle", "accountSize", "premium", "pillars", "goal", "capacity", "voiceMethod",
    ]);
  });

  it("every step has a question and explanation", () => {
    for (const s of STEPS) {
      expect(s.question.length).toBeGreaterThan(0);
      expect(s.explanation.length).toBeGreaterThan(0);
    }
  });

  it("choice steps (single/chips/toggle) define options", () => {
    const choice = STEPS.filter((s: StepDef) => s.kind !== "text");
    for (const s of choice) {
      expect(Array.isArray(s.options)).toBe(true);
      expect(s.options!.length).toBeGreaterThan(0);
    }
  });

  it("ids are unique", () => {
    expect(new Set(STEPS.map((s) => s.id)).size).toBe(STEPS.length);
  });
});
