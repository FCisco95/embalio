import { describe, it, expect } from "vitest";
import { parseCallback } from "@/lib/telegram-callback";

describe("parseCallback", () => {
  it("parses a posted payload", () => {
    expect(parseCallback("posted:abc-123")).toEqual({ action: "posted", candidateId: "abc-123" });
  });
  it("parses a skip payload", () => {
    expect(parseCallback("skip:xyz")).toEqual({ action: "skip", candidateId: "xyz" });
  });
  it("returns null for anything else", () => {
    expect(parseCallback("regen:1")).toBeNull();
    expect(parseCallback("posted:")).toBeNull();
    expect(parseCallback("garbage")).toBeNull();
  });
});
