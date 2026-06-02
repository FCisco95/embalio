import type { TrendSignal } from "./schemas";

const HN_ENDPOINT = "https://hn.algolia.com/api/v1/search";
const DEFAULT_QUERY = 'AI OR LLM OR "vibe coding" OR Solana OR blockchain OR "Claude Code"';

interface HnHit {
  objectID: string;
  title?: string;
  url?: string;
  points?: number;
  num_comments?: number;
  created_at?: string;
}

function normalizeHit(h: HnHit): TrendSignal {
  return {
    source: "hackernews",
    id: h.objectID,
    title: h.title ?? "",
    url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
    score: h.points,
    comments: h.num_comments,
    createdAt: h.created_at,
  };
}

export async function collectTrendSignals(
  opts: { query?: string; limit?: number } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<TrendSignal[]> {
  const query = opts.query ?? DEFAULT_QUERY;
  const url = `${HN_ENDPOINT}?tags=story&query=${encodeURIComponent(query)}&hitsPerPage=${opts.limit ?? 20}`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`HN search failed: ${res.status}`);
  const json = (await res.json()) as { hits: HnHit[] };
  return (json.hits ?? []).filter((h) => h.title && h.title.trim()).map(normalizeHit);
}
