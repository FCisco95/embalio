import { supabaseService } from "@/lib/supabase/server";
import { getSignalSource } from "@/lib/signals";
import type { SignalTweet } from "@/lib/signals/types";

/** Follower count from the newest pulled tweet's author metadata; null if none. */
export function latestFollowers(tweets: SignalTweet[]): number | null {
  if (tweets.length === 0) return null;
  const newest = [...tweets].sort((a, b) =>
    new Date(b.metrics_snapshot.createdAt).getTime() - new Date(a.metrics_snapshot.createdAt).getTime())[0];
  return newest.metrics_snapshot.authorFollowers || null;
}

/**
 * Capture today's follower count for a profile by pulling its own latest tweets
 * (the author metadata carries the count — zero extra vendor, ~1 actor run/day).
 * Upserts one row per (profile, day, source). Returns the count or null.
 */
export async function captureFollowerSnapshot(profileId: string): Promise<number | null> {
  const sb = supabaseService();
  const { data: profile } = await sb.from("profiles").select("handle").eq("id", profileId).single();
  if (!profile?.handle) return null;
  const tweets = await getSignalSource().pullAuthorTweets([profile.handle], { maxPerHandle: 5 });
  const followers = latestFollowers(tweets);
  if (followers === null) return null;
  const { error } = await sb.from("follower_snapshots").upsert(
    { profile_id: profileId, followers, source: "scrape" },
    { onConflict: "profile_id,snapshot_date,source" },
  );
  if (error) console.error("[follower-snapshot] upsert failed:", error.message);
  return followers;
}
