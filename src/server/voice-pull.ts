"use server";
import { makeApify, pullTweets, type ApifyLike } from "@/lib/apify";

/**
 * Pull the user's own recent posts to seed their voice corpus (zero-typing path).
 * `client` is injectable for tests; in production it defaults to makeApify().
 */
export async function pullOwnVoiceCorpus(handle: string, client?: ApifyLike): Promise<string[]> {
  if (!process.env.APIFY_TOKEN) {
    throw new Error("voice-pull unavailable: APIFY_TOKEN not set");
  }
  const actor = process.env.APIFY_TWEET_SCRAPER_ACTOR ?? "apidojo/tweet-scraper";
  const rows = await pullTweets(client ?? makeApify(), actor, { handles: [handle], maxPerHandle: 30 });
  return rows
    .map((r) => r.tweet_text.trim())
    .filter(Boolean)
    .slice(0, 30);
}
