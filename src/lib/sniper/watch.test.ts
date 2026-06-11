import { describe, it, expect } from "vitest";
import { normalizeWatchHandle, MAX_ACTIVE_WATCH_TARGETS } from "@/lib/sniper/watch";

describe("normalizeWatchHandle", () => {
  it("strips @, URL prefixes and lowercases", () => {
    expect(normalizeWatchHandle("@LevelsIo")).toBe("levelsio");
    expect(normalizeWatchHandle("https://x.com/levelsio")).toBe("levelsio");
    expect(normalizeWatchHandle("  levelsio  ")).toBe("levelsio");
  });
  it("rejects empty and invalid handles", () => {
    expect(normalizeWatchHandle("")).toBeNull();
    expect(normalizeWatchHandle("not a handle!")).toBeNull();
  });
  it("caps the active watch list at 10 (paid-tier lever)", () => {
    expect(MAX_ACTIVE_WATCH_TARGETS).toBe(10);
  });
});
