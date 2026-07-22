import { describe, it, expect, vi, beforeEach } from "vitest";

let upsertPayload: Record<string, unknown> | null;
let upsertOpts: Record<string, unknown> | null;
let upsertResult: { data: { id: string }[] | null; error: { message: string } | null };
let profileRow: Record<string, unknown> | null;
let snapshotRows: { followers: number }[];
let draftImpl: () => Promise<{ body: string }>;
let activityInserts: Record<string, unknown>[];

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/embeddings", () => ({
  embedText: async () => [1, 0],
  embedTexts: async (xs: string[]) => xs.map(() => [1, 0]),
  relevanceFromVectors: () => 0.8,
  cosine: () => 0.8,
}));
vi.mock("@/lib/drafting", () => ({
  draftReply: () => draftImpl(),
  draftOriginal: vi.fn(),
}));
vi.mock("@/lib/activity", () => ({
  logActivity: async (_sb: unknown, profileId: string, kind: string, extra: unknown) => {
    activityInserts.push({ profileId, kind, extra });
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseService: () => ({
    from: (t: string) => {
      if (t === "profiles") {
        return {
          select: () => ({
            eq: () => ({ single: async () => ({ data: profileRow }) }),
          }),
        };
      }
      if (t === "follower_snapshots") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({ limit: async () => ({ data: snapshotRows }) }),
            }),
          }),
        };
      }
      if (t === "sniper_alerts") {
        return {
          upsert: (p: Record<string, unknown>, opts: Record<string, unknown>) => {
            upsertPayload = p;
            upsertOpts = opts;
            return { select: async () => upsertResult };
          },
        };
      }
      throw new Error(`unexpected table ${t}`);
    },
  }),
}));

import { createManualAlert } from "./sniper";

beforeEach(() => {
  upsertPayload = null;
  upsertOpts = null;
  upsertResult = { data: [{ id: "alert-1" }], error: null };
  profileRow = {
    id: "p1",
    handle: "FCisco95",
    niche_description: "AI dev tooling",
    content_pillars: ["claude code"],
    voice_corpus: ["sample tweet"],
  };
  snapshotRows = [{ followers: 500 }];
  draftImpl = async () => ({ body: "solid take — the routing tradeoff is real" });
  activityInserts = [];
});

describe("createManualAlert", () => {
  const input = {
    url: "https://x.com/KaiXCreator/status/2070485879479779728?s=46",
    tweetText: "Gemini 3.5 vs Fable 5 — thread",
    authorFollowers: 9492,
    replyCount: 12,
    ageMinutes: 20,
  };

  it("parses, scores, drafts, and upserts a source='manual' row", async () => {
    const r = await createManualAlert("p1", input);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.alertId).toBe("alert-1");
    expect(r.score).toBeGreaterThan(0);
    expect(r.drop).toBeNull();
    expect(upsertPayload).toMatchObject({
      profile_id: "p1",
      source_tweet_id: "2070485879479779728",
      author_handle: "KaiXCreator",
      tweet_text: input.tweetText,
      tweet_url: "https://x.com/KaiXCreator/status/2070485879479779728",
      source: "manual",
      draft_reply: "solid take — the routing tradeoff is real",
      latency_ms: 20 * 60_000,
    });
    expect(upsertOpts).toMatchObject({ onConflict: "profile_id,source_tweet_id", ignoreDuplicates: true });
    expect(activityInserts[0]).toMatchObject({ profileId: "p1", kind: "sniper_alert_sent" });
  });

  it("returns ok:false with a reason on an unparseable URL, without touching the DB", async () => {
    const r = await createManualAlert("p1", { ...input, url: "https://example.com/nope" });
    expect(r).toEqual({ ok: false, reason: "unrecognized tweet URL" });
    expect(upsertPayload).toBeNull();
  });

  it("surfaces an advisory drop but still inserts (human already chose this tweet)", async () => {
    const r = await createManualAlert("p1", { ...input, replyCount: 80, ageMinutes: 20 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.drop).toBe("crowded");
    expect(upsertPayload).not.toBeNull();
  });

  it("a drafting failure never blocks the row (draft_reply null)", async () => {
    draftImpl = async () => { throw new Error("gen down"); };
    const r = await createManualAlert("p1", input);
    expect(r.ok).toBe(true);
    expect((upsertPayload as Record<string, unknown>).draft_reply).toBeNull();
  });

  it("duplicate tweet (upsert ignored) returns ok:false duplicate", async () => {
    upsertResult = { data: [], error: null };
    const r = await createManualAlert("p1", input);
    expect(r).toEqual({ ok: false, reason: "already alerted for this tweet" });
  });

  it("missing optional fields still scores (neutral defaults)", async () => {
    const r = await createManualAlert("p1", {
      url: "https://x.com/foo/status/123",
      tweetText: "some in-niche tweet",
    });
    expect(r.ok).toBe(true);
    expect((upsertPayload as Record<string, unknown>).latency_ms).toBe(0);
  });

  it("unknown profile returns ok:false", async () => {
    profileRow = null;
    const r = await createManualAlert("p1", input);
    expect(r).toEqual({ ok: false, reason: "profile not found" });
  });
});
