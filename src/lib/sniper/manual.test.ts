import { describe, it, expect } from "vitest";
import { parseTweetUrl, manualScoreInputs } from "./manual";

describe("parseTweetUrl", () => {
  it("parses a canonical x.com status URL", () => {
    expect(parseTweetUrl("https://x.com/KaiXCreator/status/2070485879479779728")).toEqual({
      tweetId: "2070485879479779728",
      authorHandle: "KaiXCreator",
    });
  });

  it("parses twitter.com, mobile hosts, www, and http", () => {
    for (const u of [
      "https://twitter.com/foo_bar/status/123",
      "https://www.x.com/foo_bar/status/123",
      "https://mobile.twitter.com/foo_bar/status/123",
      "http://x.com/foo_bar/status/123",
      "https://X.com/foo_bar/status/123",
    ]) {
      expect(parseTweetUrl(u)).toEqual({ tweetId: "123", authorHandle: "foo_bar" });
    }
  });

  it("ignores query string, hash, trailing slash, and /photo suffix", () => {
    expect(parseTweetUrl("https://x.com/foo/status/123?s=46&t=abc")).toEqual({ tweetId: "123", authorHandle: "foo" });
    expect(parseTweetUrl("https://x.com/foo/status/123/")).toEqual({ tweetId: "123", authorHandle: "foo" });
    expect(parseTweetUrl("https://x.com/foo/status/123/photo/1")).toEqual({ tweetId: "123", authorHandle: "foo" });
    expect(parseTweetUrl("https://x.com/foo/status/123#m")).toEqual({ tweetId: "123", authorHandle: "foo" });
  });

  it("accepts the /statuses/ legacy path and surrounding whitespace", () => {
    expect(parseTweetUrl("  https://x.com/foo/statuses/123  ")).toEqual({ tweetId: "123", authorHandle: "foo" });
  });

  it("rejects garbage, non-tweet URLs, and handle-less i/web URLs", () => {
    expect(parseTweetUrl("not a url")).toBeNull();
    expect(parseTweetUrl("https://x.com/foo")).toBeNull();
    expect(parseTweetUrl("https://x.com/i/web/status/123")).toBeNull();
    expect(parseTweetUrl("https://x.com/i/status/123")).toBeNull();
    expect(parseTweetUrl("https://example.com/foo/status/123")).toBeNull();
    expect(parseTweetUrl("https://x.com/foo/status/12a3")).toBeNull();
    expect(parseTweetUrl("")).toBeNull();
  });
});

describe("manualScoreInputs", () => {
  it("fills TargetScoreInputs with fresh/neutral defaults when optional fields are absent", () => {
    const i = manualScoreInputs({ ageMinutes: null, replyCount: null, authorFollowers: null }, 0.8, 500, 1);
    expect(i).toEqual({
      relevance: 0.8,
      ageMinutes: 0,
      replyCount: 0,
      repliesPerHour: 0,
      authorFollowers: 0,
      ownerFollowers: 500,
      bait: 1,
    });
  });

  it("derives repliesPerHour like pickAlerts (replies / max(1min, age) in hours)", () => {
    const i = manualScoreInputs({ ageMinutes: 30, replyCount: 10, authorFollowers: 2000 }, 0.5, 500, 0.9);
    expect(i.repliesPerHour).toBeCloseTo(20); // 10 replies / 0.5h
    expect(i.ageMinutes).toBe(30);
    expect(i.replyCount).toBe(10);
    expect(i.authorFollowers).toBe(2000);
  });

  it("guards the zero-age division (uses the 1-minute floor)", () => {
    const i = manualScoreInputs({ ageMinutes: 0, replyCount: 5, authorFollowers: null }, 0.5, 500, 1);
    expect(i.repliesPerHour).toBeCloseTo(300); // 5 / (1/60 h)
  });
});
