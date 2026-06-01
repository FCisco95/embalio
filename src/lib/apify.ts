import { ApifyClient } from "apify-client";
import { withRetry } from "@/lib/retry";

export type ApifyLike = Pick<ApifyClient, "actor" | "dataset">;

export interface CandidateInput {
  source_tweet_id: string;
  author_handle: string;
  tweet_text: string;
  tweet_url: string;
  metrics_snapshot: { likes: number; views: number; replies: number; authorFollowers: number; createdAt: string };
}

export function makeApify(): ApifyClient {
  return new ApifyClient({ token: process.env.APIFY_TOKEN! });
}

// Apify runs are network-bound and occasionally flake; retry transient failures.
async function runActor(client: ApifyLike, actor: string, input: object): Promise<unknown[]> {
  return withRetry(
    async () => {
      const run = await client.actor(actor).call(input);
      const { items } = await client.dataset(run.defaultDatasetId).listItems();
      return items;
    },
    { retries: 2, baseMs: 500, onRetry: (err) => console.error(`apify actor ${actor} retry:`, err) },
  );
}

export async function pullTweets(
  client: ApifyLike,
  actor: string,
  opts: { handles: string[]; maxPerHandle?: number },
): Promise<CandidateInput[]> {
  const items = await runActor(client, actor, {
    searchTerms: opts.handles.map((h) => `from:${h.replace(/^@/, "")}`),
    maxItems: (opts.maxPerHandle ?? 20) * opts.handles.length,
    sort: "Latest",
  });
  return items.map((raw) => {
    const t = raw as Record<string, any>;
    return {
      source_tweet_id: String(t.id),
      author_handle: t.author?.userName ?? t.authorUsername ?? "",
      tweet_text: t.text ?? "",
      tweet_url: t.url ?? "",
      metrics_snapshot: {
        likes: t.likeCount ?? 0,
        views: t.viewCount ?? 0,
        replies: t.replyCount ?? 0,
        authorFollowers: t.author?.followers ?? t.author?.followersCount ?? t.authorFollowers ?? 0,
        createdAt: t.createdAt ?? new Date().toISOString(),
      },
    };
  });
}

export async function scrapeMetrics(
  client: ApifyLike,
  actor: string,
  tweetUrl: string,
): Promise<{ likes: number; views: number; replies: number }> {
  const items = await runActor(client, actor, { startUrls: [{ url: tweetUrl }], maxItems: 1 });
  const t = (items[0] ?? {}) as Record<string, any>;
  return { likes: t.likeCount ?? 0, views: t.viewCount ?? 0, replies: t.replyCount ?? 0 };
}
