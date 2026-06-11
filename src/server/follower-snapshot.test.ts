import { describe, it, expect } from "vitest";
import { latestFollowers } from "@/server/follower-snapshot";
import type { SignalTweet } from "@/lib/signals/types";

const mk = (followers: number, createdAt: string): SignalTweet => ({
  source_tweet_id: String(followers), author_handle: "me", tweet_text: "t", tweet_url: "",
  metrics_snapshot: { likes: 0, views: 0, replies: 0, authorFollowers: followers, createdAt },
});

describe("latestFollowers", () => {
  it("takes the follower count from the newest tweet", () => {
    expect(latestFollowers([mk(100, "2026-06-10T10:00:00Z"), mk(105, "2026-06-11T09:00:00Z")])).toBe(105);
  });
  it("returns null when no tweets", () => {
    expect(latestFollowers([])).toBeNull();
  });
  it("returns null when newest tweet reports zero followers", () => {
    expect(latestFollowers([mk(0, "2026-06-11T09:00:00Z")])).toBeNull();
  });
});
