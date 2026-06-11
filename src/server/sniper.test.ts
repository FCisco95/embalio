import { describe, it, expect } from "vitest";
import { pickAlerts, type SniperCandidate } from "@/server/sniper";

const now = Date.now();
function cand(id: string, opts: Partial<SniperCandidate> = {}): SniperCandidate {
  return {
    source_tweet_id: id,
    author_handle: "big",
    tweet_text: "Shipped a per-user spend cap today — here's the failure mode I hit.",
    tweet_url: `https://x.com/big/status/${id}`,
    metrics_snapshot: {
      likes: 30,
      views: 900,
      replies: 8,
      authorFollowers: 6_500,
      createdAt: new Date(now - 20 * 60_000).toISOString(), // 20 min old
    },
    ...opts,
  };
}

describe("pickAlerts", () => {
  it("keeps fresh, scoring candidates above the threshold, ordered by score", () => {
    const picked = pickAlerts([cand("1"), cand("2")], (c) => (c.source_tweet_id === "1" ? 0.9 : 0.7), 1_300, 0.6, 3, now);
    expect(picked.map((p) => p.source_tweet_id)).toEqual(["1", "2"]);
    expect(picked[0].score).toBeGreaterThan(picked[1].score);
    expect(picked[0].latencyMs).toBeCloseTo(20 * 60_000, -3);
  });

  it("drops below-threshold and hard-dropped candidates", () => {
    const stale = cand("old", {
      metrics_snapshot: { likes: 2, views: 50, replies: 2, authorFollowers: 6_500, createdAt: new Date(now - 5 * 3600_000).toISOString() },
    });
    const crowded = cand("crowd", {
      metrics_snapshot: { likes: 500, views: 9000, replies: 80, authorFollowers: 6_500, createdAt: new Date(now - 20 * 60_000).toISOString() },
    });
    const picked = pickAlerts([stale, crowded, cand("good")], () => 0.9, 1_300, 0.6, 3, now);
    expect(picked.map((p) => p.source_tweet_id)).toEqual(["good"]);
  });

  it("caps alerts per poll", () => {
    const picked = pickAlerts([cand("1"), cand("2"), cand("3")], () => 0.9, 1_300, 0.6, 2, now);
    expect(picked).toHaveLength(2);
  });
});
