import { describe, it, expect } from "vitest";
import { peakToDbfs, classifyDbfs } from "./audio-meter";

describe("audio-meter", () => {
  it("full-scale peak is 0 dBFS", () => { expect(peakToDbfs(1)).toBeCloseTo(0); });
  it("half amplitude is about -6 dBFS", () => { expect(peakToDbfs(0.5)).toBeCloseTo(-6.02, 1); });
  it("silence floors at -100 dBFS", () => { expect(peakToDbfs(0)).toBe(-100); });
  it("NaN input floors at -100 dBFS", () => { expect(peakToDbfs(NaN)).toBe(-100); });
  it("classifies bands against the playbook target (-12..-6 = good)", () => {
    expect(classifyDbfs(-3)).toBe("hot");
    expect(classifyDbfs(-9)).toBe("good");
    expect(classifyDbfs(-20)).toBe("quiet");
    expect(classifyDbfs(-0.2)).toBe("clip");
  });
});
