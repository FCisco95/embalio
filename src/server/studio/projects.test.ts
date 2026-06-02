import { describe, it, expect } from "vitest";
import { assertTransition, mergeProjectPatch } from "./project-helpers";

describe("project helpers", () => {
  it("assertTransition throws on an illegal jump", () => {
    expect(() => assertTransition("topic", "publish")).toThrow(/cannot move/i);
    expect(() => assertTransition("topic", "script")).not.toThrow();
  });
  it("mergeProjectPatch stamps updated_at and keeps prior fields", () => {
    const patch = mergeProjectPatch({ stage: "script", script: { title: "T", hook: "H", beats: [] } }, "2026-06-02T00:00:00Z");
    expect(patch.stage).toBe("script");
    expect(patch.updated_at).toBe("2026-06-02T00:00:00Z");
  });
});
