import { describe, it, expect, vi, beforeEach } from "vitest";

// A chainable + awaitable Supabase stub: every query-builder method returns the
// same proxy, and awaiting it resolves to the result configured for the table
// passed to the most recent `from(...)`.
function makeSupabase(byTable: Record<string, unknown>) {
  let current: unknown = { data: null };
  const chain: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") return (resolve: (v: unknown) => void) => resolve(current);
        return () => chain;
      },
    },
  );
  return {
    from: (table: string) => {
      current = byTable[table] ?? { data: null };
      return chain;
    },
  };
}

const draftReply = vi.fn().mockResolvedValue({ body: "reply", suggestedVisual: undefined, model_used: "subscription" });

vi.mock("@/lib/drafting", () => ({ draftReply }));
vi.mock("@/lib/apify", () => ({
  makeApify: () => ({}),
  pullTweets: vi.fn().mockResolvedValue([
    {
      source_tweet_id: "1", author_handle: "a", tweet_text: "t1", tweet_url: "https://x.com/a/status/1",
      metrics_snapshot: { likes: 5, views: 50, replies: 1, createdAt: new Date().toISOString() },
    },
  ]),
}));
vi.mock("@/lib/embeddings", () => ({
  embedText: vi.fn().mockResolvedValue([0.1, 0.2]),
  embedTexts: vi.fn().mockResolvedValue([[0.1, 0.2]]),
  relevanceFromVectors: vi.fn().mockReturnValue(0.7),
}));
vi.mock("@/lib/supabase/server", () => ({ supabaseService: vi.fn() }));

const profile = { id: "p1", handle: "@me", niche_description: "ai", voice_corpus: ["x"], voice_notes: "" };

beforeEach(async () => {
  vi.clearAllMocks();
  const { supabaseService } = await import("@/lib/supabase/server");
  vi.mocked(supabaseService).mockReturnValue(
    makeSupabase({
      profiles: { data: profile },
      seed_targets: { data: [{ handle: "@seed" }] },
      candidates: { data: [{ id: "c1", tweet_text: "t1" }] },
      drafts: { count: 0, data: null },
    }) as never,
  );
});

describe("scanTargetsForProfile (cron path)", () => {
  it("surfaces candidates without ever invoking claude/draftReply", async () => {
    const { scanTargetsForProfile } = await import("@/server/targeting");
    const n = await scanTargetsForProfile("p1");
    expect(n).toBeGreaterThan(0);
    expect(draftReply).not.toHaveBeenCalled();
  });
});

describe("refreshTargetsForProfile (local full run)", () => {
  it("scans and then drafts via claude", async () => {
    const { refreshTargetsForProfile } = await import("@/server/targeting");
    await refreshTargetsForProfile("p1");
    expect(draftReply).toHaveBeenCalled();
  });
});
