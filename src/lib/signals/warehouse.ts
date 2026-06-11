import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import type { SignalTweet, SignalSourceId } from "@/lib/signals/types";

export function toSignalTweetRow(t: SignalTweet, source: SignalSourceId) {
  return {
    source,
    source_tweet_id: t.source_tweet_id,
    author_handle: t.author_handle,
    author_followers: t.metrics_snapshot.authorFollowers,
    text: t.tweet_text,
    url: t.tweet_url,
    tweet_created_at: t.metrics_snapshot.createdAt,
    last_seen_at: new Date().toISOString(),
    raw: (t.raw ?? null) as Json,
  };
}

export function toSnapshotRow(signalTweetId: string, t: SignalTweet) {
  return {
    signal_tweet_id: signalTweetId,
    likes: t.metrics_snapshot.likes,
    views: t.metrics_snapshot.views,
    replies: t.metrics_snapshot.replies,
  };
}

/**
 * Persist every pulled tweet into the permanent warehouse + one metric snapshot each.
 * Fire-and-forget semantics: logs and returns 0 on failure — the warehouse must
 * never break the scan path it rides on. Returns rows warehoused.
 */
export async function warehouseTweets(
  sb: SupabaseClient<Database>,
  source: SignalSourceId,
  tweets: SignalTweet[],
): Promise<number> {
  if (tweets.length === 0) return 0;
  try {
    const { data, error } = await sb
      .from("signal_tweets")
      .upsert(tweets.map((t) => toSignalTweetRow(t, source)), { onConflict: "source_tweet_id" })
      .select("id, source_tweet_id");
    if (error || !data) {
      console.error("[warehouse] upsert failed:", error?.message);
      return 0;
    }
    const idByTweet = new Map(data.map((r) => [r.source_tweet_id, r.id]));
    const snapshots = tweets
      .filter((t) => idByTweet.has(t.source_tweet_id))
      .map((t) => toSnapshotRow(idByTweet.get(t.source_tweet_id)!, t));
    const { error: snapErr } = await sb.from("tweet_metric_snapshots").insert(snapshots);
    if (snapErr) console.error("[warehouse] snapshot insert failed:", snapErr.message);
    return data.length;
  } catch (err) {
    console.error("[warehouse] unexpected:", err);
    return 0;
  }
}
