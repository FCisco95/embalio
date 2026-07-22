# Manual Sniper Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner paste a tweet URL on `/engage` while browsing X → score it with the existing `targetScore()` → draft a reply → persist as a `sniper_alerts` row (`source='manual'`) that flows into the existing pin/caps/send flow and the GATE-2 scorecard — zero Apify.

**Architecture:** One new pure lib (`src/lib/sniper/manual.ts`: URL parsing + manual-field → score-input conversion), one additive migration (`source` column), one server function (`createManualAlert` in `src/server/sniper.ts` mirroring `runSniperPoll`'s per-alert path minus polling/notify), one thin client form wired above `SniperPins` on `/engage`. Existing `getSniperPins`, caps, skip-reasons, and `computeScorecard` need **no changes** — a manual row is just a `status='sent'` alert.

**Tech Stack:** Next.js App Router, Supabase service client, vitest, zod. Test conventions: pure-lib tests colocated (`*.test.ts`); server tests boundary-mock `@/lib/supabase/server` with thenable chains (see `src/server/sniper-outcome.test.ts`).

**Constraints (do not violate):**
- No Apify / `getSignalSource()` calls anywhere in this feature.
- No X API write; send stays via `lib/send/intent.ts` first-party composer URLs (already handled by `SniperPins`).
- P4 Predictions / P6 Strategy untouched.
- Score/drop are **advisory** in manual mode — the human already chose this tweet; never block the insert on drop or low score, just surface it.

---

### Task 1: Pure lib — `parseTweetUrl` + `manualScoreInputs`

**Files:**
- Create: `src/lib/sniper/manual.ts`
- Test: `src/lib/sniper/manual.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/sniper/manual.test.ts
import { describe, it, expect } from "vitest";
import { parseTweetUrl, manualScoreInputs } from "./manual";

describe("parseTweetUrl", () => {
  it("parses a canonical x.com status URL", () => {
    expect(parseTweetUrl("https://x.com/KaiXCreator/status/2070485879479779728")).toEqual({
      tweetId: "2070485879479779728",
      authorHandle: "KaiXCreator",
    });
  });

  it("parses twitter.com, mobile hosts, www, and http", () => {
    for (const u of [
      "https://twitter.com/foo_bar/status/123",
      "https://www.x.com/foo_bar/status/123",
      "https://mobile.twitter.com/foo_bar/status/123",
      "http://x.com/foo_bar/status/123",
    ]) {
      expect(parseTweetUrl(u)).toEqual({ tweetId: "123", authorHandle: "foo_bar" });
    }
  });

  it("ignores query string, hash, trailing slash, and /photo suffix", () => {
    expect(parseTweetUrl("https://x.com/foo/status/123?s=46&t=abc")).toEqual({ tweetId: "123", authorHandle: "foo" });
    expect(parseTweetUrl("https://x.com/foo/status/123/")).toEqual({ tweetId: "123", authorHandle: "foo" });
    expect(parseTweetUrl("https://x.com/foo/status/123/photo/1")).toEqual({ tweetId: "123", authorHandle: "foo" });
    expect(parseTweetUrl("https://x.com/foo/status/123#m")).toEqual({ tweetId: "123", authorHandle: "foo" });
  });

  it("accepts the /statuses/ legacy path and surrounding whitespace", () => {
    expect(parseTweetUrl("  https://x.com/foo/statuses/123  ")).toEqual({ tweetId: "123", authorHandle: "foo" });
  });

  it("rejects garbage, non-tweet URLs, and handle-less i/web URLs", () => {
    expect(parseTweetUrl("not a url")).toBeNull();
    expect(parseTweetUrl("https://x.com/foo")).toBeNull();
    expect(parseTweetUrl("https://x.com/i/web/status/123")).toBeNull();
    expect(parseTweetUrl("https://example.com/foo/status/123")).toBeNull();
    expect(parseTweetUrl("https://x.com/foo/status/12a3")).toBeNull();
    expect(parseTweetUrl("")).toBeNull();
  });
});

describe("manualScoreInputs", () => {
  it("fills TargetScoreInputs with fresh/neutral defaults when optional fields are absent", () => {
    const i = manualScoreInputs({ ageMinutes: null, replyCount: null, authorFollowers: null }, 0.8, 500, 1);
    expect(i).toEqual({
      relevance: 0.8,
      ageMinutes: 0,
      replyCount: 0,
      repliesPerHour: 0,
      authorFollowers: 0,
      ownerFollowers: 500,
      bait: 1,
    });
  });

  it("derives repliesPerHour like pickAlerts (replies / max(1min, age) in hours)", () => {
    const i = manualScoreInputs({ ageMinutes: 30, replyCount: 10, authorFollowers: 2000 }, 0.5, 500, 0.9);
    expect(i.repliesPerHour).toBeCloseTo(20); // 10 replies / 0.5h
    expect(i.ageMinutes).toBe(30);
    expect(i.replyCount).toBe(10);
    expect(i.authorFollowers).toBe(2000);
  });

  it("guards the zero-age division (uses the 1-minute floor)", () => {
    const i = manualScoreInputs({ ageMinutes: 0, replyCount: 5, authorFollowers: null }, 0.5, 500, 1);
    expect(i.repliesPerHour).toBeCloseTo(300); // 5 / (1/60 h)
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/sniper/manual.test.ts`
Expected: FAIL — `Cannot find module './manual'` (or equivalent).

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/sniper/manual.ts
/**
 * Manual sniper mode — the owner pastes a tweet URL while browsing X (zero
 * Apify). Pure helpers only: URL → id/handle, and manual-entry fields →
 * TargetScoreInputs so the same targetScore() judges manual and polled
 * targets identically. Unknown fields default to score.ts's neutral values
 * (0 followers → sizeFit 1 / followback 0.5; age 0 → full recency — the
 * owner is looking at the tweet right now).
 */
import type { TargetScoreInputs } from "./score";

export interface ParsedTweetUrl {
  tweetId: string;
  authorHandle: string;
}

const TWEET_URL_RE =
  /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d+)(?:\/|\?|#|$)/;

/** x.com / twitter.com status URL → id + handle; null when unrecognized (incl. handle-less /i/web/ links). */
export function parseTweetUrl(raw: string): ParsedTweetUrl | null {
  const m = TWEET_URL_RE.exec(raw.trim());
  if (!m) return null;
  const [, authorHandle, tweetId] = m;
  if (authorHandle.toLowerCase() === "i") return null; // x.com/i/web/status/<id> has no author handle
  return { tweetId, authorHandle };
}

export interface ManualTargetFields {
  ageMinutes?: number | null;
  replyCount?: number | null;
  authorFollowers?: number | null;
}

/** Manual-entry fields (all optional) → the exact input shape targetScore() expects. */
export function manualScoreInputs(
  fields: ManualTargetFields,
  relevance: number,
  ownerFollowers: number,
  bait: number,
): TargetScoreInputs {
  const ageMinutes = fields.ageMinutes ?? 0;
  const replyCount = fields.replyCount ?? 0;
  // Same velocity formula as pickAlerts (server/sniper.ts): 1-minute floor.
  const repliesPerHour = replyCount / Math.max(1 / 60, ageMinutes / 60);
  return {
    relevance,
    ageMinutes,
    replyCount,
    repliesPerHour,
    authorFollowers: fields.authorFollowers ?? 0,
    ownerFollowers,
    bait,
  };
}
```

Note: `TargetScoreInputs` in `src/lib/sniper/score.ts` does not currently include `replyCount` — **check before coding**: it DOES (`replyCount: number` is used for the crowd drop). Match the interface exactly; if a field name differs, the test in Step 1 must be adjusted to the real interface, not the other way around.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/sniper/manual.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sniper/manual.ts src/lib/sniper/manual.test.ts
git commit -m "feat(sniper): pure manual-mode helpers — tweet URL parse + manual score inputs"
```

---

### Task 2: Migration + hand-reflected types — `source` column

**Files:**
- Create: `supabase/migrations/20260722_sniper_manual_source.sql`
- Modify: `src/lib/supabase/types.ts` (sniper_alerts Row ~line 711, Insert ~line 732, Update ~line 753)

- [ ] **Step 1: Write the migration**

```sql
-- Manual sniper mode: distinguish cron-discovered alerts from owner-pasted ones.
-- 'poll'   = discovered by the sniper-poll cron (Apify signal source).
-- 'manual' = owner pasted a tweet URL on /engage (zero Apify; GATE-2 data
--            keeps accruing while polling is off).
-- Additive + idempotent; default backfills all existing rows as 'poll'.
alter table public.sniper_alerts
  add column if not exists source text not null default 'poll';
alter table public.sniper_alerts
  drop constraint if exists sniper_alerts_source_check;
alter table public.sniper_alerts
  add constraint sniper_alerts_source_check check (source in ('poll','manual'));
```

- [ ] **Step 2: Hand-reflect the column into types.ts**

In `src/lib/supabase/types.ts`, inside `sniper_alerts`:
- `Row`: add `source: string` (alphabetical — after `skip_reason`, before `source_tweet_id`).
- `Insert`: add `source?: string`.
- `Update`: add `source?: string`.

- [ ] **Step 3: Verify tsc + suite still clean**

Run: `npx tsc --noEmit && npm test`
Expected: clean / 718 green, 1 skip (no behavior change yet).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260722_sniper_manual_source.sql src/lib/supabase/types.ts
git commit -m "feat(sniper): source column ('poll'|'manual') on sniper_alerts"
```

**NOTE for ship step (end of plan):** this migration must be applied to PROD `vzxpakxjnuaesfxihyvl` via Supabase MCP `apply_migration` BEFORE the code that inserts `source='manual'` deploys (same migrate-before-push ordering as Session 16).

---

### Task 3: Server — `createManualAlert`

**Files:**
- Modify: `src/server/sniper.ts` (append after `setReplyOutcome`)
- Test: `src/server/sniper-manual.test.ts`

- [ ] **Step 1: Write the failing tests**

Boundary-mock style copied from `src/server/sniper-outcome.test.ts` / `sniper.test.ts`: mock `@/lib/supabase/server`, `@/lib/embeddings`, `@/lib/drafting`, `@/lib/activity`, `next/cache`. No mock of `@/lib/signals` needed — `createManualAlert` must never import/call `getSignalSource`.

```ts
// src/server/sniper-manual.test.ts
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
  draftReply: (...args: unknown[]) => draftImpl(),
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/server/sniper-manual.test.ts`
Expected: FAIL — `createManualAlert` is not exported.

- [ ] **Step 3: Implement `createManualAlert` in `src/server/sniper.ts`**

Add imports at top (merge with existing import lines): `parseTweetUrl, manualScoreInputs` from `@/lib/sniper/manual`; `buildStatusUrl` is already imported.

Append after `setReplyOutcome`:

```ts
const ManualAlertInput = z.object({
  url: z.string().min(1),
  tweetText: z.string().trim().min(1).max(4000),
  authorFollowers: z.number().int().nonnegative().nullable().optional(),
  replyCount: z.number().int().nonnegative().nullable().optional(),
  ageMinutes: z.number().nonnegative().nullable().optional(),
});
export type ManualAlertInputType = z.infer<typeof ManualAlertInput>;

export type ManualAlertResult =
  | { ok: true; alertId: string; score: number; parts: TargetScoreParts; drop: string | null; draft: string | null }
  | { ok: false; reason: string };

/**
 * Manual sniper mode (zero Apify): the owner pastes a tweet URL while browsing
 * X. Same scorer, drafter, and ledger as the polled path — the row lands as
 * status='sent' + source='manual', so getSniperPins, caps, skip-reasons, and
 * the GATE-2 scorecard all work unchanged. Score/drop are advisory only: the
 * human already chose this tweet, so we never refuse the insert on score.
 * No notify() — the owner is looking at the screen that shows the pin.
 */
export async function createManualAlert(
  profileId: string,
  rawInput: ManualAlertInputType,
): Promise<ManualAlertResult> {
  const input = ManualAlertInput.parse(rawInput);
  const parsed = parseTweetUrl(input.url);
  if (!parsed) return { ok: false, reason: "unrecognized tweet URL" };

  const sb = supabaseService();
  const { data: profile } = await sb.from("profiles").select("*").eq("id", profileId).single();
  if (!profile) return { ok: false, reason: "profile not found" };

  // Same relevance + owner-followers derivation as runSniperPoll.
  const voiceVec = await embedText(
    [profile.niche_description, ...((profile.content_pillars ?? []) as string[]), ...profile.voice_corpus]
      .filter(Boolean)
      .join(" "),
  );
  const tweetVec = await embedText(input.tweetText);
  const relevance = relevanceFromVectors(voiceVec, tweetVec);

  const { data: snap } = await sb
    .from("follower_snapshots")
    .select("followers")
    .eq("profile_id", profileId)
    .order("snapshot_date", { ascending: false })
    .limit(1);
  const ownerFollowers = snap?.[0]?.followers ?? knobsFromProfile(profile).ownerFollowerEstimate;

  const r = targetScore(
    manualScoreInputs(
      { ageMinutes: input.ageMinutes, replyCount: input.replyCount, authorFollowers: input.authorFollowers },
      relevance,
      ownerFollowers,
      baitScore(input.tweetText),
    ),
  );

  let draft: string | null = null;
  try {
    const d = await draftReply(profile, input.tweetText);
    draft = d.body?.trim() || null;
  } catch (err) {
    console.error("[sniper] manual draft failed (alert still created):", String(err).slice(0, 160));
  }

  const { data: inserted, error } = await sb
    .from("sniper_alerts")
    .upsert(
      {
        profile_id: profileId,
        source_tweet_id: parsed.tweetId,
        author_handle: parsed.authorHandle,
        tweet_text: input.tweetText,
        tweet_url: buildStatusUrl(parsed.authorHandle, parsed.tweetId),
        score: r.score,
        score_parts: r.parts as unknown as Json,
        latency_ms: Math.round((input.ageMinutes ?? 0) * 60_000),
        draft_reply: draft,
        source: "manual",
      },
      { onConflict: "profile_id,source_tweet_id", ignoreDuplicates: true },
    )
    .select("id");
  if (error) return { ok: false, reason: `saving manual alert failed: ${error.message}` };
  if (!inserted || inserted.length === 0) return { ok: false, reason: "already alerted for this tweet" };

  await logActivity(sb, profileId, "sniper_alert_sent", {
    refId: parsed.tweetId,
    meta: { score: r.score, source: "manual" },
  });
  revalidatePath("/engage");
  return { ok: true, alertId: inserted[0].id, score: r.score, parts: r.parts, drop: r.drop, draft };
}
```

Implementation notes:
- `TargetScoreParts` is already imported in sniper.ts (type import from `@/lib/sniper/score`). `targetScore` too.
- Mock-shape check: the test's `upsert(...).select(...)` returns `upsertResult` directly — the real chain is awaited the same way as in `runSniperPoll` (`.upsert(...).select("id")`). Keep the call shape identical to `runSniperPoll`'s.
- Do NOT call `notify()` and do NOT touch `channels` (stays `{}` default — that plus `source='manual'` marks the row).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/server/sniper-manual.test.ts`
Expected: PASS (all 7).

- [ ] **Step 5: Full suite + tsc**

Run: `npx tsc --noEmit && npm test`
Expected: clean; suite grows by ~10-13 tests, all green, 1 pre-existing skip.

- [ ] **Step 6: Commit**

```bash
git add src/server/sniper.ts src/server/sniper-manual.test.ts
git commit -m "feat(sniper): createManualAlert — paste-a-URL manual mode, Apify-free"
```

---

### Task 4: Server action + `/engage` UI form

**Files:**
- Modify: `src/server/sniper-actions.ts`
- Create: `src/components/manual-sniper-form.tsx`
- Modify: `src/app/(app)/engage/page.tsx:47` (insert form above `<SniperPins …>`)

- [ ] **Step 1: Add the server action**

Append to `src/server/sniper-actions.ts`:

```ts
export async function createManualSniperAlert(
  profileId: string,
  input: import("@/server/sniper").ManualAlertInputType,
): Promise<import("@/server/sniper").ManualAlertResult> {
  const { createManualAlert } = await import("@/server/sniper");
  return createManualAlert(profileId, input);
}
```

(If the file's existing style uses top-level static imports — it does — prefer matching it: add `createManualAlert`, `type ManualAlertInputType`, `type ManualAlertResult` to the existing import from `@/server/sniper` and re-export a thin wrapper like the others:)

```ts
export async function createManualSniperAlert(
  profileId: string,
  input: ManualAlertInputType,
): Promise<ManualAlertResult> {
  return createManualAlert(profileId, input);
}
```

Use the static-import form; the dynamic form above is the fallback only if `"use server"` re-export rules complain about type exports (types are erased — they won't).

- [ ] **Step 2: Create the client form**

```tsx
// src/components/manual-sniper-form.tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createManualSniperAlert } from "@/server/sniper-actions";

const DROP_LABEL: Record<string, string> = {
  crowded: "30+ replies — hard to land top-5",
  stale: "over 3h old and not hot",
  bait: "reads like engagement bait",
};

/**
 * Manual sniper mode: paste a tweet URL you're looking at on X, add what you
 * can see (text required; followers/replies/age optional), and the sniper
 * scores + drafts it into a normal pin below. Zero Apify.
 */
export function ManualSniperForm({ profileId }: { profileId: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [followers, setFollowers] = useState("");
  const [replies, setReplies] = useState("");
  const [age, setAge] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const num = (s: string): number | null => {
    const n = Number(s.trim());
    return s.trim() === "" || !Number.isFinite(n) || n < 0 ? null : n;
  };

  function submit() {
    setMsg(null);
    startTransition(async () => {
      try {
        const r = await createManualSniperAlert(profileId, {
          url,
          tweetText: text,
          authorFollowers: num(followers) === null ? null : Math.round(num(followers) as number),
          replyCount: num(replies) === null ? null : Math.round(num(replies) as number),
          ageMinutes: num(age),
        });
        if (!r.ok) {
          setMsg({ kind: "err", text: r.reason });
          return;
        }
        const scoreTxt = `pinned below — score ${Math.round(r.score * 100)}`;
        setMsg(
          r.drop
            ? { kind: "warn", text: `${scoreTxt} · ⚠ ${DROP_LABEL[r.drop] ?? r.drop} (your call)` }
            : { kind: "ok", text: scoreTxt },
        );
        setUrl(""); setText(""); setFollowers(""); setReplies(""); setAge("");
        router.refresh(); // getSniperPins re-runs → the new pin renders with draft + caps + Send
      } catch {
        setMsg({ kind: "err", text: "something went wrong — check the URL and try again" });
      }
    });
  }

  return (
    <div className="mb-3 rounded-lg border border-border p-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-[12px] font-medium text-muted-foreground hover:text-foreground"
      >
        🎯 Manual sniper — paste a tweet URL {open ? "▴" : "▾"}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://x.com/…/status/…"
            className="w-full text-[13px] rounded-md border border-border bg-background p-2"
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the tweet text"
            rows={2}
            className="w-full text-[13px] rounded-md border border-border bg-background p-2"
          />
          <div className="flex gap-2">
            <input value={followers} onChange={(e) => setFollowers(e.target.value)} placeholder="Author followers (opt)"
              inputMode="numeric" className="flex-1 min-w-0 text-[12px] rounded-md border border-border bg-background p-2" />
            <input value={replies} onChange={(e) => setReplies(e.target.value)} placeholder="Replies (opt)"
              inputMode="numeric" className="flex-1 min-w-0 text-[12px] rounded-md border border-border bg-background p-2" />
            <input value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age min (opt)"
              inputMode="numeric" className="flex-1 min-w-0 text-[12px] rounded-md border border-border bg-background p-2" />
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={pending || !url.trim() || !text.trim()}
              onClick={submit}
              className="text-[12px] px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-500 font-medium disabled:opacity-40"
            >
              {pending ? "Scoring…" : "Score & pin"}
            </button>
            {msg && (
              <span className={`text-[11px] ${msg.kind === "err" ? "text-red-500" : msg.kind === "warn" ? "text-amber-500" : "text-muted-foreground"}`}>
                {msg.text}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire into `/engage`**

In `src/app/(app)/engage/page.tsx`, add import:

```tsx
import { ManualSniperForm } from "@/components/manual-sniper-form";
```

and inside the `activeTab === "engage"` block, directly above the `SniperPins` line:

```tsx
{profiles[0] && <ManualSniperForm profileId={profiles[0].id} />}
{profiles[0] && <SniperPins profileId={profiles[0].id} pins={sniperPins} />}
```

- [ ] **Step 4: Suite + tsc + build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all clean/green.

- [ ] **Step 5: Commit**

```bash
git add src/server/sniper-actions.ts src/components/manual-sniper-form.tsx "src/app/(app)/engage/page.tsx"
git commit -m "feat(engage): manual sniper form — paste URL, score, pin (GATE-2 unlock, zero Apify)"
```

---

### Task 5: Ship (ordered — migrate BEFORE push)

- [ ] **Step 1: Apply migration to PROD** — Supabase MCP `apply_migration` on project `vzxpakxjnuaesfxihyvl` with the contents of `20260722_sniper_manual_source.sql`. Verify: `select column_name from information_schema.columns where table_name='sniper_alerts' and column_name='source';` returns 1 row.
- [ ] **Step 2: Push** `git push origin main` → Vercel auto-deploys.
- [ ] **Step 3: Smoke** — prod 200 on `/engage`; paste a real tweet URL end-to-end once (owner-visible pin, Send opens composer).

---

## Self-review notes

- Spec coverage: URL paste ✅ (T1/T4) · parse id+handle ✅ (T1) · manual fields ✅ (T1/T3/T4) · targetScore ✅ (T3) · existing draft path ✅ (T3 `draftReply`) · one-tap intent ✅ (free via `getSniperPins`/`SniperPins`) · persist with source marker ✅ (T2/T3) · caps + skip + scorecard keep working ✅ (no changes needed — verified by reading `getSniperPins`, `computeScorecard`) · caps advisory like pin flow ✅ (pin carries `blockedBy`).
- Types match: `ManualAlertInputType` (T3) is what T4's action passes; `manualScoreInputs` (T1) signature matches T3's call.
- Freeze-safe: no P4/P6 imports; no `getSignalSource`; no notify spam; no X API write.
