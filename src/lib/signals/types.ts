import type { CandidateInput } from "@/lib/apify";

/** A tweet as seen by any signal source. Superset of CandidateInput so the
 *  existing scan/rank pipeline consumes it unchanged; `raw` feeds the warehouse. */
export type SignalTweet = CandidateInput & { raw?: Record<string, unknown> };

export type SignalSourceId = "apify" | "twitterapi" | "grok" | "xapi";

export interface SignalSource {
  readonly id: SignalSourceId;
  pullAuthorTweets(handles: string[], opts: { maxPerHandle?: number }): Promise<SignalTweet[]>;
  pullTweetMetrics(tweetUrl: string): Promise<{ likes: number; views: number; replies: number }>;
}
