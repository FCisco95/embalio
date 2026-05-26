import { ApifyClient } from "apify-client";

export type ApifyLike = Pick<ApifyClient, "actor" | "dataset">;

export interface CandidateInput {
  source_tweet_id: string;
  author_handle: string;
  tweet_text: string;
  tweet_url: string;
  metrics_snapshot: { likes: number; views: number; replies: number; createdAt: string };
}

export function makeApify(): ApifyClient {
  return new ApifyClient({ token: process.env.APIFY_TOKEN! });
}

async function runActor(client: ApifyLike, actor: string, input: object): Promise<unknown[]> {
  const run: any = await client.actor(actor).call(input);
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return items;
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
