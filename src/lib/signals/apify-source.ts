import { makeApify, pullTweets, scrapeMetrics, type ApifyLike } from "@/lib/apify";
import type { SignalSource, SignalTweet } from "@/lib/signals/types";

export function makeApifySource(client?: ApifyLike, actor?: string): SignalSource {
  const c = client ?? makeApify();
  const a = actor ?? process.env.APIFY_TWEET_SCRAPER_ACTOR!;
  return {
    id: "apify",
    async pullAuthorTweets(handles, opts): Promise<SignalTweet[]> {
      return pullTweets(c, a, { handles, maxPerHandle: opts.maxPerHandle });
    },
    async pullTweetMetrics(tweetUrl) {
      return scrapeMetrics(c, a, tweetUrl);
    },
  };
}
