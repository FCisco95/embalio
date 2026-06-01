import { describe, it, expect } from "vitest";
import { rankCandidates } from "@/server/targeting";
import type { CandidateInput } from "@/lib/apify";

const now = Date.now();
const mk = (id: string, likes: number, ageH: number): CandidateInput => ({
  source_tweet_id: id, author_handle: "a", tweet_text: `t${id}`, tweet_url: `https://x.com/a/status/${id}`,
  metrics_snapshot: { likes, views: likes * 10, replies: 1, authorFollowers: 0, createdAt: new Date(now - ageH * 3600_000).toISOString() },
});

describe("rankCandidates", () => {
  it("orders by composite score and respects topN", () => {
    const cands = [mk("1", 5, 40), mk("2", 200, 1), mk("3", 50, 2)];
    const relevances = { "1": 0.2, "2": 0.9, "3": 0.6 };
    const ranked = rankCandidates(cands, (c) => relevances[c.source_tweet_id as "1"], 2);
    expect(ranked).toHaveLength(2);
    expect(ranked[0].source_tweet_id).toBe("2");
    expect(ranked[0].score_composite).toBeGreaterThan(ranked[1].score_composite!);
  });
});

function cand(id: string, authorFollowers: number, replies: number): CandidateInput {
  return {
    source_tweet_id: id, author_handle: "@x", tweet_text: "t", tweet_url: "u",
    metrics_snapshot: { likes: 50, views: 0, replies, authorFollowers, createdAt: new Date().toISOString() },
  };
}

describe("rankCandidates with owner size", () => {
  it("ranks an in-band, uncrowded post above a mega-account crowded one", () => {
    const cands = [cand("mega", 5_000_000, 200), cand("inband", 25_000, 3)];
    const ranked = rankCandidates(cands, () => 1, 2, 2750);
    expect(ranked[0].source_tweet_id).toBe("inband");
  });
});
