import { describe, it, expect, vi } from "vitest";
import { toSignalTweetRow, toSnapshotRow, warehouseTweets } from "@/lib/signals/warehouse";
import type { SignalTweet } from "@/lib/signals/types";

const tweet: SignalTweet = {
  source_tweet_id: "111", author_handle: "alice",
  tweet_text: "hello", tweet_url: "https://x.com/a/status/111",
  raw: { id: "111" },
  metrics_snapshot: { likes: 3, views: 200, replies: 1, authorFollowers: 5000, createdAt: "2026-06-11T08:00:00Z" },
};

describe("warehouse mappers", () => {
  it("maps a SignalTweet to a signal_tweets row", () => {
    const row = toSignalTweetRow(tweet, "apify");
    expect(row).toMatchObject({
      source: "apify", source_tweet_id: "111", author_handle: "alice",
      author_followers: 5000, text: "hello", url: "https://x.com/a/status/111",
      tweet_created_at: "2026-06-11T08:00:00Z",
    });
    expect(row.last_seen_at).toBeTruthy();
  });

  it("maps metrics to a snapshot row", () => {
    expect(toSnapshotRow("uuid-1", tweet)).toMatchObject({
      signal_tweet_id: "uuid-1", likes: 3, views: 200, replies: 1,
    });
  });
});

describe("warehouseTweets", () => {
  it("upserts all tweets and snapshots each upserted row", async () => {
    const upsert = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [{ id: "uuid-1", source_tweet_id: "111" }], error: null }),
    });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const sb = { from: vi.fn((t: string) => (t === "signal_tweets" ? { upsert } : { insert })) };
    const n = await warehouseTweets(sb as never, "apify", [tweet]);
    expect(n).toBe(1);
    expect(upsert).toHaveBeenCalledOnce();
    expect(insert).toHaveBeenCalledWith([expect.objectContaining({ signal_tweet_id: "uuid-1" })]);
  });

  it("dedupes same source_tweet_id within a batch before upserting", async () => {
    const upsert = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [{ id: "uuid-1", source_tweet_id: "111" }], error: null }),
    });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const sb = { from: vi.fn((t: string) => (t === "signal_tweets" ? { upsert } : { insert })) };
    const dup = { ...tweet };
    const n = await warehouseTweets(sb as never, "apify", [tweet, dup]);
    expect(n).toBe(1);
    expect(upsert.mock.calls[0][0]).toHaveLength(1);
    expect(insert).toHaveBeenCalledWith([expect.objectContaining({ signal_tweet_id: "uuid-1" })]);
  });

  it("returns 0 immediately for empty input", async () => {
    const sb = { from: vi.fn() };
    await expect(warehouseTweets(sb as never, "apify", [])).resolves.toBe(0);
    expect(sb.from).not.toHaveBeenCalled();
  });

  it("never throws — returns 0 on db error", async () => {
    const sb = { from: vi.fn(() => ({ upsert: vi.fn(() => ({ select: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }) })) })) };
    await expect(warehouseTweets(sb as never, "apify", [tweet])).resolves.toBe(0);
  });
});
