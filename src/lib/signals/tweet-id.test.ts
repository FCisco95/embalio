import { describe, it, expect } from "vitest";
import { tweetIdFromUrl } from "@/lib/signals/tweet-id";

describe("tweetIdFromUrl", () => {
  it("extracts the status id", () => {
    expect(tweetIdFromUrl("https://x.com/FCisco95/status/2063935385118404971")).toBe("2063935385118404971");
    expect(tweetIdFromUrl("https://twitter.com/a/status/123?s=20")).toBe("123");
  });
  it("returns null for non-status urls", () => {
    expect(tweetIdFromUrl("https://x.com/FCisco95")).toBeNull();
  });
});
