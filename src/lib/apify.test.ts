import { describe, it, expect, vi } from "vitest";
import { pullTweets, scrapeMetrics, type ApifyLike } from "@/lib/apify";

function fakeClient(items: unknown[]): ApifyLike {
  return {
    actor: () => ({
      call: vi.fn().mockResolvedValue({ defaultDatasetId: "ds1" }),
    }),
    dataset: () => ({
      listItems: vi.fn().mockResolvedValue({ items }),
    }),
  } as unknown as ApifyLike;
}

describe("apify client", () => {
  it("pullTweets maps actor items to Candidate inputs", async () => {
    const client = fakeClient([
      { id: "1", url: "https://x.com/a/status/1", text: "hi", author: { userName: "a" },
        likeCount: 10, viewCount: 100, replyCount: 2, createdAt: new Date().toISOString() },
    ]);
    const rows = await pullTweets(client, "actor", { handles: ["a"] });
    expect(rows[0]).toMatchObject({ source_tweet_id: "1", author_handle: "a", tweet_text: "hi" });
    expect(rows[0].metrics_snapshot.likes).toBe(10);
  });

  it("scrapeMetrics returns likes/views/replies for a tweet url", async () => {
    const client = fakeClient([{ id: "9", likeCount: 5, viewCount: 50, replyCount: 1 }]);
    const m = await scrapeMetrics(client, "actor", "https://x.com/a/status/9");
    expect(m).toEqual({ likes: 5, views: 50, replies: 1 });
  });

  it("maps author follower count into metrics_snapshot", async () => {
    const client = fakeClient([
      { id: "1", url: "https://x.com/a/status/1", text: "hi", author: { userName: "a", followers: 1234 }, likeCount: 2, viewCount: 9, replyCount: 1, createdAt: "2026-05-30T00:00:00Z" },
    ]);
    const out = await pullTweets(client, "actor", { handles: ["@a"] });
    expect(out[0].metrics_snapshot.authorFollowers).toBe(1234);
  });
});
