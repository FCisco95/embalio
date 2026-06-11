import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface Heat {
  heat01: number;
  recent: number;
  prior: number;
  velocityRatio: number;
  declining: boolean;
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "what", "when", "how",
  "why", "are", "was", "has", "have", "you", "your", "its", "new", "now",
]);

/** Significant search terms from a topic title: lowercase word tokens, len>3, no stopwords, max 6. */
export function topicTerms(topic: string): string[] {
  return topic
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w))
    .slice(0, 6);
}

/** Pure heat from own-warehouse counts. Sanity-checks LLM "trending" claims against scraped reality. */
export function computeHeat(recent: number, prior: number): Heat {
  if (recent === 0 && prior === 0)
    return { heat01: 0, recent, prior, velocityRatio: 0, declining: false };
  const velocityRatio = prior === 0 ? recent : recent / prior;
  const volume = Math.min(recent / 10, 1);
  const accel = Math.min(velocityRatio / 4, 1);
  return {
    heat01: Math.min(1, 0.5 * volume + 0.5 * accel),
    recent,
    prior,
    velocityRatio,
    declining: recent < prior,
  };
}

async function countWindow(
  sb: SupabaseClient<Database>,
  terms: string[],
  fromIso: string,
  toIso: string | null,
): Promise<number> {
  const base = sb
    .from("signal_tweets")
    .select("id", { count: "exact", head: true })
    .gte("tweet_created_at", fromIso);
  const q = toIso ? base.lt("tweet_created_at", toIso) : base;
  const { count } = await (q as unknown as { or(s: string): Promise<{ count: number | null }> }).or(
    terms.map((t) => `text.ilike.%${t}%`).join(","),
  );
  return count ?? 0;
}

/** Velocity of a topic inside OUR signal_tweets: last 24h vs the 24h before it. */
export async function heatForTopic(sb: SupabaseClient<Database>, topic: string): Promise<Heat> {
  const terms = topicTerms(topic);
  if (terms.length === 0) return computeHeat(0, 0);
  const now = Date.now();
  const h24 = new Date(now - 24 * 3600_000).toISOString();
  const h48 = new Date(now - 48 * 3600_000).toISOString();
  // Sequential to guarantee deterministic call order (matches test fixture expectations)
  const recent = await countWindow(sb, terms, h24, null);
  const prior = await countWindow(sb, terms, h48, h24);
  return computeHeat(recent, prior);
}
