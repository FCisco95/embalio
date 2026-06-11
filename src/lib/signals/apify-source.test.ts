import { describe, it, expect } from "vitest";
import { makeApifySource } from "@/lib/signals/apify-source";
import type { ApifyLike } from "@/lib/apify";

function fakeApify(items: unknown[]): ApifyLike {
  return {
    actor: () => ({ call: async () => ({ defaultDatasetId: "ds" }) }),
    dataset: () => ({ listItems: async () => ({ items }) }),
  } as unknown as ApifyLike;
}

const rawItem = {
  id: "111", text: "hello", url: "https://x.com/a/status/111",
  author: { userName: "alice", followers: 5000 },
  likeCount: 3, viewCount: 200, replyCount: 1, createdAt: "2026-06-11T08:00:00Z",
};

describe("apify SignalSource", () => {
  it("maps actor items to SignalTweets and keeps the raw payload", async () => {
    const src = makeApifySource(fakeApify([rawItem]), "actor/x");
    const tweets = await src.pullAuthorTweets(["alice"], { maxPerHandle: 5 });
    expect(tweets).toHaveLength(1);
    expect(tweets[0].source_tweet_id).toBe("111");
    expect(tweets[0].author_handle).toBe("alice");
    expect(tweets[0].metrics_snapshot.authorFollowers).toBe(5000);
    expect(tweets[0].raw).toMatchObject({ id: "111" });
  });

  it("maps scrape metrics for a single tweet url", async () => {
    const src = makeApifySource(fakeApify([{ likeCount: 7, viewCount: 900, replyCount: 2 }]), "actor/x");
    await expect(src.pullTweetMetrics("https://x.com/a/status/111")).resolves.toEqual({
      likes: 7, views: 900, replies: 2,
    });
  });
});
