/**
 * X API v2 client contract — Day-0 contract of the 2026-10 revamp.
 *
 * Lane A implements it in `src/lib/x-api/client.ts` (OAuth 2.0 user context,
 * token refresh + rotation). Lanes C/D/E build against this interface with mocks
 * until that lands. Pricing is X's pay-per-use schedule (docs.x.com, 2026-10-21).
 *
 * Rule: nothing under `src/lib/x-api/` may import `@/lib/supabase/server` — it
 * pulls `next/headers` and kills `scripts/*.ts`. Pass a Supabase client in.
 */

export interface XPublicMetrics {
  like_count: number;
  reply_count: number;
  retweet_count: number;
  quote_count?: number;
  bookmark_count?: number;
  /** Views. Present in `public_metrics` since late 2022. */
  impression_count?: number;
}

export interface XTweet {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
  public_metrics?: XPublicMetrics;
  entities?: Record<string, unknown>;
  in_reply_to_user_id?: string;
}

export interface XUserPublicMetrics {
  followers_count: number;
  following_count: number;
  tweet_count?: number;
  listed_count?: number;
}

export interface XUser {
  id: string;
  username: string;
  name?: string;
  public_metrics?: XUserPublicMetrics;
}

export interface XPageMeta {
  result_count: number;
  newest_id?: string;
  oldest_id?: string;
  next_token?: string;
}

export interface XPage<T> {
  data: T[];
  includes?: { users?: XUser[] };
  meta?: XPageMeta;
}

export interface XSearchRecentParams {
  /** Full X search query, e.g. `(from:a OR from:b) -is:retweet -is:reply`. ≤512 chars. */
  query: string;
  since_id?: string;
  start_time?: string;
  /** 10–100. */
  max_results?: number;
  next_token?: string;
  tweetFields?: string[];
  expansions?: string[];
  userFields?: string[];
}

export interface XUserTweetsParams {
  start_time?: string;
  since_id?: string;
  /** 5–100. */
  max_results?: number;
  exclude?: Array<"replies" | "retweets">;
  pagination_token?: string;
  tweetFields?: string[];
}

export interface XCreateTweetInput {
  text: string;
  reply?: { in_reply_to_tweet_id: string };
}

export interface XCreateTweetResult {
  id: string;
  text: string;
}

export interface XClient {
  /** The Embalio profile this client acts for. */
  readonly profileId: string;
  /** The linked X user id / handle (from `x_accounts`). */
  readonly xUserId: string;
  readonly username: string;

  createTweet(input: XCreateTweetInput): Promise<XCreateTweetResult>;
  getMe(opts?: { userFields?: string[] }): Promise<XUser>;
  getUserTweets(userId: string, params?: XUserTweetsParams): Promise<XPage<XTweet>>;
  searchRecent(params: XSearchRecentParams): Promise<XPage<XTweet>>;
  getTweet(id: string, opts?: { tweetFields?: string[] }): Promise<XTweet>;

  /** Running estimate of pay-per-use spend for this client instance, in USD. */
  readonly estimatedCostUsd: number;
}

/** Thrown when the refresh token is dead (`invalid_grant`); the account needs re-linking. */
export class XReauthRequired extends Error {
  constructor(public readonly profileId: string, message = "X account needs re-authorization") {
    super(message);
    this.name = "XReauthRequired";
  }
}

/** Thrown on HTTP 429; `resetAt` comes from `x-rate-limit-reset`. */
export class XRateLimited extends Error {
  constructor(public readonly resetAt: Date, message = "X API rate limited") {
    super(message);
    this.name = "XRateLimited";
  }
}

/**
 * The request was dispatched but we got no complete HTTP answer from X (timeout/abort,
 * network error, or a response body cut off mid-read). For a write the outcome is UNKNOWN:
 * X may have acted. Contrast with an HTTP error status (a definite rejection, `XApiError`
 * in client.ts). Publishers must treat a transport failure of `createTweet` as maybe-sent
 * and never retry it blindly.
 */
export class XTransportError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "XTransportError";
  }
}

/** X pay-per-use unit prices, USD (docs.x.com/x-api/getting-started/pricing, 2026-10-21). */
export const X_COST_USD = {
  postRead: 0.005,
  ownPostRead: 0.001,
  userRead: 0.01,
  postCreate: 0.015,
  postCreateWithUrl: 0.2,
} as const;
