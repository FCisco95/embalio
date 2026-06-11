import { describe, it, expect, vi, beforeEach } from "vitest";

const generateStructured = vi.fn();
vi.mock("@/lib/generate", () => ({ generateStructured: (...a: unknown[]) => generateStructured(...a) }));

const gateTrend = vi.fn();
vi.mock("@/lib/credibility/gate", () => ({ gateTrend: (...a: unknown[]) => gateTrend(...a) }));

vi.mock("@/lib/embeddings", () => ({
  embedTexts: vi.fn(async (texts: string[]) => texts.map(() => [1, 0])),
  relevanceFromVectors: vi.fn(() => 0.9),
}));

vi.mock("./heat", async (importOriginal) => {
  const real = await importOriginal<typeof import("./heat")>();
  return { ...real, heatForTopic: vi.fn(async () => real.computeHeat(8, 2)) };
});

import { generateTopicBoard } from "./board";

const report = {
  topics: [
    { topic: "Agent SDK v2", why_now: "released yesterday", angle: "my port story", kind: "spike", sources: [{ url: "https://x.com/a/status/1", title: "launch", published_at: "2026-06-11T07:00:00Z" }] },
    { topic: "Crypto tax law", why_now: "vote passed", angle: "n/a", kind: "durable", sources: [{ url: "https://news.example/b", title: "vote", published_at: "2026-06-10T07:00:00Z" }] },
  ],
  generatedAt: "June 11, 2026",
};

function makeSb() {
  const inserted: unknown[] = [];
  const updated: unknown[] = [];
  const sb = {
    from: vi.fn((table: string) => {
      if (table === "profiles")
        return { select: () => ({ eq: () => ({ single: async () => ({ data: { content_pillars: ["AI tooling"], niche_description: "indie AI builders" }, error: null }) }) }) };
      if (table === "signal_tweets")
        return { select: () => ({ gte: () => ({ order: () => ({ limit: async () => ({ data: [{ author_handle: "levelsio", text: "agents", url: "u", tweet_created_at: "2026-06-11T05:00:00Z" }], error: null }) }) }) }) };
      if (table === "topic_history")
        return {
          update: (v: unknown) => ({ eq: () => ({ eq: async () => { updated.push(v); return { error: null }; } }) }),
          insert: async (rows: unknown[]) => { inserted.push(...rows); return { error: null }; },
        };
      throw new Error(`unexpected table ${table}`);
    }),
  };
  return { sb, inserted, updated };
}

beforeEach(() => {
  generateStructured.mockReset();
  gateTrend.mockReset();
});

describe("generateTopicBoard", () => {
  it("generates, gates, scores, expires old rows, inserts new ones", async () => {
    generateStructured.mockResolvedValue({ data: report });
    gateTrend
      .mockResolvedValueOnce({ keep: true, angle: "sharper angle", reason: "you ship agents weekly" })
      .mockResolvedValueOnce({ keep: false, angle: "", reason: "no standing" });
    const { sb, inserted, updated } = makeSb();
    const n = await generateTopicBoard(sb as never, "profile-1");
    expect(n).toBe(1);
    expect(updated[0]).toMatchObject({ status: "expired" });
    const row = inserted[0] as Record<string, unknown>;
    expect(row.profile_id).toBe("profile-1");
    expect(row.topic).toBe("Agent SDK v2");
    expect(row.angle).toBe("sharper angle");
    expect(typeof row.score).toBe("number");
    expect(row.status).toBe("fresh");
    expect(row.expires_at).toBeTruthy();
    const why = row.why as Record<string, unknown>;
    expect(why.reason).toBe("you ship agents weekly");
    expect(why.kind).toBe("spike");
    expect((row.sources as unknown[]).length).toBe(1);
  });
  it("falls back to gemini when claude path yields no data and GOOGLE key set", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "k");
    generateStructured
      .mockResolvedValueOnce({ data: null, raw: "garbage" })
      .mockResolvedValueOnce({ data: report });
    gateTrend.mockResolvedValue({ keep: true, angle: "a", reason: "r" });
    const { sb } = makeSb();
    await generateTopicBoard(sb as never, "p");
    expect(generateStructured).toHaveBeenCalledTimes(2);
    expect(generateStructured.mock.calls[1][2]).toMatchObject({ backend: "gemini" });
    vi.unstubAllEnvs();
  });
  it("throws when generation fails everywhere", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
    generateStructured.mockResolvedValue({ data: null, raw: "" });
    const { sb } = makeSb();
    await expect(generateTopicBoard(sb as never, "p")).rejects.toThrow(/topic board generation failed/);
    vi.unstubAllEnvs();
  });
  it("throws when every topic is gate-dropped (never writes an empty board)", async () => {
    generateStructured.mockResolvedValue({ data: report });
    gateTrend.mockResolvedValue({ keep: false, angle: "", reason: "no" });
    const { sb, inserted } = makeSb();
    await expect(generateTopicBoard(sb as never, "p")).rejects.toThrow(/all topics gate-dropped/);
    expect(inserted).toHaveLength(0);
  });
});
