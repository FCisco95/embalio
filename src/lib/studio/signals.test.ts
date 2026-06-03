import { describe, it, expect, vi } from "vitest";
import { collectTrendSignals } from "./signals";

function fakeFetch(payload: unknown, ok = true): typeof fetch {
  return vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => payload })) as unknown as typeof fetch;
}

describe("collectTrendSignals", () => {
  it("normalizes HN hits into TrendSignal[]", async () => {
    const f = fakeFetch({ hits: [
      { objectID: "1", title: "Vibe coding on Solana", url: "https://a", points: 120, num_comments: 30, created_at: "2026-06-01T00:00:00Z" },
      { objectID: "2", title: "", url: "https://b" }, // dropped: no title
    ] });
    const out = await collectTrendSignals({ limit: 10 }, f);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ source: "hackernews", id: "1", title: "Vibe coding on Solana", score: 120 });
  });
  it("falls back to the HN item URL when a hit has no url", async () => {
    const f = fakeFetch({ hits: [{ objectID: "9", title: "x" }] });
    const out = await collectTrendSignals({}, f);
    expect(out[0].url).toBe("https://news.ycombinator.com/item?id=9");
  });
  it("throws on a non-OK response", async () => {
    await expect(collectTrendSignals({}, fakeFetch({}, false))).rejects.toThrow(/HN search failed/);
  });
});
