import { describe, it, expect } from "vitest";
import { canTransition, nextStage, isEarlierStage } from "./stages";

describe("stage transitions", () => {
  it("allows a single forward step", () => {
    expect(canTransition("topic", "script")).toBe(true);
    expect(canTransition("script", "record")).toBe(true);
  });
  it("allows stepping back to re-edit", () => {
    expect(canTransition("record", "script")).toBe(true);
    expect(canTransition("publish", "topic")).toBe(true);
  });
  it("rejects skipping forward by more than one", () => {
    expect(canTransition("topic", "record")).toBe(false);
  });
  it("rejects unknown stages", () => {
    // @ts-expect-error invalid stage
    expect(canTransition("topic", "bogus")).toBe(false);
  });
  it("returns the next stage or null at the end", () => {
    expect(nextStage("topic")).toBe("script");
    expect(nextStage("repurposed")).toBeNull();
  });
  it("isEarlierStage is true only for strictly earlier targets", () => {
    expect(isEarlierStage("publish", "record")).toBe(true);
    expect(isEarlierStage("publish", "topic")).toBe(true);
    expect(isEarlierStage("publish", "publish")).toBe(false);
    expect(isEarlierStage("record", "publish")).toBe(false);
    // @ts-expect-error invalid stage
    expect(isEarlierStage("record", "bogus")).toBe(false);
  });
});
