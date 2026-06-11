# Revamp P0+P1 — Merge Train + Signal Warehouse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify three live branches into a `main` trunk (P0), then build the source-agnostic `SignalSource` adapter + permanent signal warehouse so every tweet Embalio sees is stored forever (P1).

**Architecture:** P0 is a git merge train (wedge tip → nudge → recording-cockpit → main) with `sp1-cockpit-x` explicitly excluded (stale, salvage later). P1 adds an adapter interface over the existing Apify transport (`src/lib/apify.ts` stays the transport), four service-role warehouse tables, an activity-event log wired into existing post/reply actions, and a daily follower snapshot riding the same Apify actor. Nothing user-visible changes in P1 — it's the foundation P2 (topics) and P5 (sniper) stand on.

**Tech Stack:** Next.js 16 App Router, Supabase Postgres (service-role via `supabaseService()`), Apify `apidojo/tweet-scraper`, Vitest (colocated `*.test.ts`), Zod.

**Spec:** `cisco-brain/10 - PROJECTS/Embalio/specs/2026-06-11-growth-operator-revamp-design.md`
**Decisions locked with user (2026-06-11):** merge train safe to run now · exclude `feat/sp1-cockpit-x` (salvage `publish()` adapter + who-to-follow later) · Vercel production → `main` after P0 · `watch_targets` table waits for P5.

---

## Task 1: Merge train (P0)

**Files:** none created — git operations in `C:\Users\joao_\Desktop\projects\embalio`.

Branch state at planning time: current branch `feat/nudge-telegram-callback` @ `e9fa172` (clean); `feat/engage-mobile-wedge` @ `a6d9c27` (checked out in worktree `..\embalio-engage-wedge` — merging *from* it is fine, don't check it out); `feat/recording-cockpit` @ `7af784a`; `main` behind 132. **419 passed / 1 skipped** is the green bar.

- [ ] **Step 1: Verify clean state + fetch**

Run: `git status --short` (expect empty) and `git fetch origin`

- [ ] **Step 2: Merge wedge tip into nudge branch (current)**

```bash
git merge feat/engage-mobile-wedge -m "merge: engage-wedge tip (freshness gate + surface-only scan) into nudge line"
```

Nudge branched from the wedge at `acc2691`, so only 2 commits (`87f3797`, `a6d9c27`) come in. Conflicts unlikely; if `src/server/targeting.ts` or `src/lib/supabase/types.ts` conflict, keep BOTH sides' additions (union) — both branches only added code.

- [ ] **Step 3: Test gate**

Run: `npm test`
Expected: 419+ passed, 1 skipped, 0 failed. If failures: fix before proceeding, never skip.

- [ ] **Step 4: Merge into recording-cockpit**

```bash
git checkout feat/recording-cockpit
git merge feat/nudge-telegram-callback -m "merge: nudge/telegram callbacks + engage mobile wedge into cockpit line"
```

Expected conflict zone: `src/lib/supabase/types.ts` (regenerate in Task 3 anyway — resolve by union), `src/server/targeting.ts` (union of added functions).

- [ ] **Step 5: Test gate**

Run: `npm test` → 419+ green. Then `npm run build` → exits 0.

- [ ] **Step 6: Merge into main + push everything**

```bash
git checkout main
git merge feat/recording-cockpit -m "merge: Phase 1a + 1b + mobile wedge + telegram callbacks — main becomes trunk"
npm test
git push origin main feat/recording-cockpit feat/nudge-telegram-callback feat/engage-mobile-wedge
```

- [ ] **Step 7: Vercel production branch → main**

If a Vercel project is linked (`vercel whoami` / dashboard): set Production Branch to `main` (Project Settings → Git), trigger a deploy. If no Vercel project linked, note it and skip — local `npm run dev` remains the dogfood path.

- [ ] **Step 8: Remove the wedge worktree (branch is merged; keep sp1 untouched)**

```bash
git worktree remove ../embalio-engage-wedge
```

Keep `..\dispatchAI-sp1-cockpit-x` + `feat/sp1-cockpit-x` — salvage list: `publish()` X adapter dry-run (`08e34f0`), who-to-follow (`dd935e4`).

---

## Task 2: Pending migrations + P0 dogfood gate

**Files:** `supabase/migrations/20260609_posts_tweet_url_nullable.sql`, `supabase/migrations/20260609_profiles_retention.sql` (already exist in repo).

- [ ] **Step 1: Check which migrations the live DB has**

Use Supabase MCP `list_migrations` on project `vzxpakxjnuaesfxihyvl` (or `npx supabase migration list --linked`). `posts.tweet_url nullable` was applied 2026-06-09 per vault; verify `profiles_retention` too.

- [ ] **Step 2: Apply any missing migration**

Use Supabase MCP `apply_migration` with the file's SQL verbatim. Verify: `select column_name from information_schema.columns where table_name='profiles' and column_name='retention';` returns a row.

- [ ] **Step 3: Dogfood checklist (manual, phone)**

- Install PWA on phone (serves `/engage` start_url)
- One-tap **Done** on a candidate ticks the coach quota on `/`
- Nudge + Telegram poll fire per `docs/runbooks/2026-06-09-nudge-telegram-triggers.md`

Record results in the session log. Failures here are P0 bugs — fix before P1.

---

## Task 3: Warehouse migration + regenerated types (P1 starts)

**Files:**
- Create: `supabase/migrations/20260611_signal_warehouse.sql`
- Regenerate: `src/lib/supabase/types.ts`

Branch first: `git checkout -b feat/revamp-p1-signal-warehouse main`

- [ ] **Step 1: Write the migration**

```sql
-- Signal warehouse: global proprietary dataset. Service-role only (like research_briefings).
create table if not exists public.signal_tweets (
  id               uuid primary key default gen_random_uuid(),
  source           text not null,
  source_tweet_id  text not null unique,
  author_handle    text not null,
  author_followers int  not null default 0,
  text             text not null default '',
  url              text not null default '',
  lang             text,
  tweet_created_at timestamptz,
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  deleted_at       timestamptz,
  raw              jsonb
);
create index if not exists signal_tweets_author_idx
  on public.signal_tweets (author_handle, tweet_created_at desc);
alter table public.signal_tweets disable row level security;

-- Metric time series: snapshots, never updates-in-place — velocity lives in the deltas.
create table if not exists public.tweet_metric_snapshots (
  id              uuid primary key default gen_random_uuid(),
  signal_tweet_id uuid not null references public.signal_tweets(id) on delete cascade,
  captured_at     timestamptz not null default now(),
  likes           int not null default 0,
  views           int not null default 0,
  replies         int not null default 0,
  reposts         int,
  bookmarks       int
);
create index if not exists tweet_metric_snapshots_tweet_idx
  on public.tweet_metric_snapshots (signal_tweet_id, captured_at desc);
alter table public.tweet_metric_snapshots disable row level security;

-- App-action ledger: powers activity counters (P3 KPIs) + sniper alert idempotency (P5).
create table if not exists public.activity_events (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in
    ('reply_posted','post_published','engage_done','draft_created',
     'csv_imported','sniper_alert_sent','sniper_alert_acted','scan_run')),
  ref_id     text,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_events_profile_idx
  on public.activity_events (profile_id, created_at desc);
alter table public.activity_events disable row level security;

-- Topic boards persisted (P2 reads/writes; created now so the migration batch is one).
create table if not exists public.topic_history (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  topic        text not null,
  angle        text,
  score        int,
  why          jsonb not null default '{}'::jsonb,
  sources      jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  expires_at   timestamptz,
  status       text not null default 'fresh'
);
create index if not exists topic_history_profile_idx
  on public.topic_history (profile_id, generated_at desc);
alter table public.topic_history disable row level security;

-- Daily follower counts. One row per profile per day per source.
create table if not exists public.follower_snapshots (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  snapshot_date date not null default (now()::date),
  captured_at   timestamptz not null default now(),
  followers     int not null,
  following     int,
  source        text not null default 'scrape' check (source in ('csv','scrape','manual')),
  annotation    text,
  unique (profile_id, snapshot_date, source)
);
alter table public.follower_snapshots disable row level security;
```

- [ ] **Step 2: Apply to live DB**

Supabase MCP `apply_migration` (name `signal_warehouse`, SQL above). Verify: `select count(*) from signal_tweets;` → 0.

- [ ] **Step 3: Regenerate types**

Supabase MCP `generate_typescript_types` → replace `src/lib/supabase/types.ts` wholesale (it's generated format). Run `npm test` + `npx tsc --noEmit` — both green (regen also cleans any Task-1 union-merge artifacts).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260611_signal_warehouse.sql src/lib/supabase/types.ts
git commit -m "feat(db): signal warehouse — signal_tweets, metric snapshots, activity events, topic history, follower snapshots"
```

---

## Task 4: SignalSource adapter

**Files:**
- Create: `src/lib/signals/types.ts`, `src/lib/signals/apify-source.ts`, `src/lib/signals/twitterapi-source.ts`, `src/lib/signals/grok-source.ts`, `src/lib/signals/index.ts`
- Modify: `src/lib/apify.ts` (attach `raw` to pulled tweets)
- Test: `src/lib/signals/index.test.ts`, `src/lib/signals/apify-source.test.ts`

- [ ] **Step 1: Write failing tests**

`src/lib/signals/index.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { getSignalSource } from "@/lib/signals";

describe("getSignalSource", () => {
  const orig = process.env.SIGNAL_SOURCE;
  afterEach(() => { process.env.SIGNAL_SOURCE = orig; });

  it("defaults to apify", () => {
    delete process.env.SIGNAL_SOURCE;
    expect(getSignalSource().id).toBe("apify");
  });

  it("throws on unknown source", () => {
    process.env.SIGNAL_SOURCE = "carrier-pigeon";
    expect(() => getSignalSource()).toThrow(/unknown SIGNAL_SOURCE/i);
  });

  it("twitterapi slot exists but is not implemented yet", () => {
    process.env.SIGNAL_SOURCE = "twitterapi";
    const src = getSignalSource();
    expect(src.id).toBe("twitterapi");
    await expect(src.pullAuthorTweets(["x"], {})).rejects.toThrow(/not implemented/i);
  });
});
```

(Make the third test `async` — `it("...", async () => { ... })`.)

`src/lib/signals/apify-source.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { makeApifySource } from "@/lib/signals/apify-source";
import type { ApifyLike } from "@/lib/apify";

function fakeApify(items: unknown[]): ApifyLike {
  return {
    actor: () => ({ call: async () => ({ defaultDatasetId: "ds" }) }),
    dataset: () => ({ listItems: async () => ({ items }) }),
  } as unknown as ApifyLike;
}

const rawItem = {
  id: "111", text: "hello", url: "https://x.com/a/status/111",
  author: { userName: "alice", followers: 5000 },
  likeCount: 3, viewCount: 200, replyCount: 1, createdAt: "2026-06-11T08:00:00Z",
};

describe("apify SignalSource", () => {
  it("maps actor items to SignalTweets and keeps the raw payload", async () => {
    const src = makeApifySource(fakeApify([rawItem]), "actor/x");
    const tweets = await src.pullAuthorTweets(["alice"], { maxPerHandle: 5 });
    expect(tweets).toHaveLength(1);
    expect(tweets[0].source_tweet_id).toBe("111");
    expect(tweets[0].author_handle).toBe("alice");
    expect(tweets[0].metrics_snapshot.authorFollowers).toBe(5000);
    expect(tweets[0].raw).toMatchObject({ id: "111" });
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test -- signals`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Implement**

`src/lib/signals/types.ts`:

```ts
import type { CandidateInput } from "@/lib/apify";

/** A tweet as seen by any signal source. Superset of CandidateInput so the
 *  existing scan/rank pipeline consumes it unchanged; `raw` feeds the warehouse. */
export type SignalTweet = CandidateInput & { raw?: Record<string, unknown> };

export type SignalSourceId = "apify" | "twitterapi" | "grok" | "xapi";

export interface SignalSource {
  readonly id: SignalSourceId;
  pullAuthorTweets(handles: string[], opts: { maxPerHandle?: number }): Promise<SignalTweet[]>;
  pullTweetMetrics(tweetUrl: string): Promise<{ likes: number; views: number; replies: number }>;
}
```

`src/lib/apify.ts` — in `pullTweets`, attach the original item (one added line in the returned object):

```ts
  return items.map((raw) => {
    const t = raw as Record<string, any>;
    return {
      source_tweet_id: String(t.id),
      author_handle: t.author?.userName ?? t.authorUsername ?? "",
      tweet_text: t.text ?? "",
      tweet_url: t.url ?? "",
      raw: t,
      metrics_snapshot: { /* unchanged */ },
    };
  });
```

and widen the return type: `Promise<(CandidateInput & { raw?: Record<string, unknown> })[]>`.

`src/lib/signals/apify-source.ts`:

```ts
import { pullTweets, scrapeMetrics, type ApifyLike } from "@/lib/apify";
import { makeApify } from "@/lib/apify";
import type { SignalSource, SignalTweet } from "@/lib/signals/types";

export function makeApifySource(client?: ApifyLike, actor?: string): SignalSource {
  const c = client ?? makeApify();
  const a = actor ?? process.env.APIFY_TWEET_SCRAPER_ACTOR!;
  return {
    id: "apify",
    async pullAuthorTweets(handles, opts): Promise<SignalTweet[]> {
      return pullTweets(c, a, { handles, maxPerHandle: opts.maxPerHandle });
    },
    async pullTweetMetrics(tweetUrl) {
      return scrapeMetrics(c, a, tweetUrl);
    },
  };
}
```

`src/lib/signals/twitterapi-source.ts` (and `grok-source.ts` identically, with its id):

```ts
import type { SignalSource } from "@/lib/signals/types";

/** Slot for twitterapi.io — filled when revenue funds the upgrade (spec decision 12). */
export function makeTwitterapiSource(): SignalSource {
  return {
    id: "twitterapi",
    async pullAuthorTweets() { throw new Error("twitterapi source not implemented yet"); },
    async pullTweetMetrics() { throw new Error("twitterapi source not implemented yet"); },
  };
}
```

`src/lib/signals/index.ts`:

```ts
import { makeApifySource } from "@/lib/signals/apify-source";
import { makeTwitterapiSource } from "@/lib/signals/twitterapi-source";
import { makeGrokSource } from "@/lib/signals/grok-source";
import type { SignalSource } from "@/lib/signals/types";

export type { SignalSource, SignalTweet, SignalSourceId } from "@/lib/signals/types";

export function getSignalSource(): SignalSource {
  const key = process.env.SIGNAL_SOURCE ?? "apify";
  if (key === "apify") return makeApifySource();
  if (key === "twitterapi") return makeTwitterapiSource();
  if (key === "grok") return makeGrokSource();
  throw new Error(`unknown SIGNAL_SOURCE: ${key}`);
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test -- signals` → PASS. Then full `npm test` (apify.test.ts must stay green — the `raw` addition is additive).

- [ ] **Step 5: Commit**

```bash
git add src/lib/signals src/lib/apify.ts
git commit -m "feat(signals): SignalSource adapter — apify impl, twitterapi/grok slots, env routing"
```

---

## Task 5: Warehouse writer

**Files:**
- Create: `src/lib/signals/warehouse.ts`
- Test: `src/lib/signals/warehouse.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, vi } from "vitest";
import { toSignalTweetRow, toSnapshotRow, warehouseTweets } from "@/lib/signals/warehouse";
import type { SignalTweet } from "@/lib/signals/types";

const tweet: SignalTweet = {
  source_tweet_id: "111", author_handle: "alice",
  tweet_text: "hello", tweet_url: "https://x.com/a/status/111",
  raw: { id: "111" },
  metrics_snapshot: { likes: 3, views: 200, replies: 1, authorFollowers: 5000, createdAt: "2026-06-11T08:00:00Z" },
};

describe("warehouse mappers", () => {
  it("maps a SignalTweet to a signal_tweets row", () => {
    const row = toSignalTweetRow(tweet, "apify");
    expect(row).toMatchObject({
      source: "apify", source_tweet_id: "111", author_handle: "alice",
      author_followers: 5000, text: "hello", url: "https://x.com/a/status/111",
      tweet_created_at: "2026-06-11T08:00:00Z",
    });
    expect(row.last_seen_at).toBeTruthy();
  });

  it("maps metrics to a snapshot row", () => {
    expect(toSnapshotRow("uuid-1", tweet)).toMatchObject({
      signal_tweet_id: "uuid-1", likes: 3, views: 200, replies: 1,
    });
  });
});

describe("warehouseTweets", () => {
  it("upserts all tweets and snapshots each upserted row", async () => {
    const upsert = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [{ id: "uuid-1", source_tweet_id: "111" }], error: null }),
    });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const sb = { from: vi.fn((t: string) => (t === "signal_tweets" ? { upsert } : { insert })) };
    const n = await warehouseTweets(sb as never, "apify", [tweet]);
    expect(n).toBe(1);
    expect(upsert).toHaveBeenCalledOnce();
    expect(insert).toHaveBeenCalledWith([expect.objectContaining({ signal_tweet_id: "uuid-1" })]);
  });

  it("never throws — returns 0 on db error", async () => {
    const sb = { from: vi.fn(() => ({ upsert: vi.fn(() => ({ select: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }) })) })) };
    await expect(warehouseTweets(sb as never, "apify", [tweet])).resolves.toBe(0);
  });
});
```

- [ ] **Step 2: Run tests, verify fail** — `npm test -- warehouse` → FAIL (module missing).

- [ ] **Step 3: Implement `src/lib/signals/warehouse.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import type { SignalTweet, SignalSourceId } from "@/lib/signals/types";

export function toSignalTweetRow(t: SignalTweet, source: SignalSourceId) {
  return {
    source,
    source_tweet_id: t.source_tweet_id,
    author_handle: t.author_handle,
    author_followers: t.metrics_snapshot.authorFollowers,
    text: t.tweet_text,
    url: t.tweet_url,
    tweet_created_at: t.metrics_snapshot.createdAt,
    last_seen_at: new Date().toISOString(),
    raw: (t.raw ?? null) as Json,
  };
}

export function toSnapshotRow(signalTweetId: string, t: SignalTweet) {
  return {
    signal_tweet_id: signalTweetId,
    likes: t.metrics_snapshot.likes,
    views: t.metrics_snapshot.views,
    replies: t.metrics_snapshot.replies,
  };
}

/**
 * Persist every pulled tweet into the permanent warehouse + one metric snapshot each.
 * Fire-and-forget semantics: logs and returns 0 on failure — the warehouse must
 * never break the scan path it rides on. Returns rows warehoused.
 */
export async function warehouseTweets(
  sb: SupabaseClient<Database>,
  source: SignalSourceId,
  tweets: SignalTweet[],
): Promise<number> {
  if (tweets.length === 0) return 0;
  try {
    const { data, error } = await sb
      .from("signal_tweets")
      .upsert(tweets.map((t) => toSignalTweetRow(t, source)), { onConflict: "source_tweet_id" })
      .select("id, source_tweet_id");
    if (error || !data) {
      console.error("[warehouse] upsert failed:", error?.message);
      return 0;
    }
    const idByTweet = new Map(data.map((r) => [r.source_tweet_id, r.id]));
    const snapshots = tweets
      .filter((t) => idByTweet.has(t.source_tweet_id))
      .map((t) => toSnapshotRow(idByTweet.get(t.source_tweet_id)!, t));
    const { error: snapErr } = await sb.from("tweet_metric_snapshots").insert(snapshots);
    if (snapErr) console.error("[warehouse] snapshot insert failed:", snapErr.message);
    return data.length;
  } catch (err) {
    console.error("[warehouse] unexpected:", err);
    return 0;
  }
}
```

- [ ] **Step 4: Run tests, verify pass** — `npm test -- warehouse` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/signals/warehouse.ts src/lib/signals/warehouse.test.ts
git commit -m "feat(warehouse): warehouseTweets — upsert signal_tweets + metric snapshot per pull, never-throw"
```

---

## Task 6: Wire adapter + warehouse into scan and tracking

**Files:**
- Modify: `src/server/targeting.ts` (lines 1–2 imports, 63 pull call, after 66 warehouse call)
- Modify: `src/app/api/cron/tracking/route.ts`
- Create: `src/lib/signals/tweet-id.ts` + `src/lib/signals/tweet-id.test.ts`

- [ ] **Step 1: Failing test for URL→id extraction**

`src/lib/signals/tweet-id.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { tweetIdFromUrl } from "@/lib/signals/tweet-id";

describe("tweetIdFromUrl", () => {
  it("extracts the status id", () => {
    expect(tweetIdFromUrl("https://x.com/FCisco95/status/2063935385118404971")).toBe("2063935385118404971");
    expect(tweetIdFromUrl("https://twitter.com/a/status/123?s=20")).toBe("123");
  });
  it("returns null for non-status urls", () => {
    expect(tweetIdFromUrl("https://x.com/FCisco95")).toBeNull();
  });
});
```

Run: `npm test -- tweet-id` → FAIL.

- [ ] **Step 2: Implement `src/lib/signals/tweet-id.ts`**

```ts
/** Extract the numeric status id from an x.com/twitter.com URL, else null. */
export function tweetIdFromUrl(url: string): string | null {
  const m = url.match(/\/status\/(\d+)/);
  return m ? m[1] : null;
}
```

Run: `npm test -- tweet-id` → PASS.

- [ ] **Step 3: Switch `scanTargetsForProfile` to the adapter + warehouse every pull**

In `src/server/targeting.ts`: replace the import of `makeApify, pullTweets` with:

```ts
import { type CandidateInput } from "@/lib/apify";
import { getSignalSource } from "@/lib/signals";
import { warehouseTweets } from "@/lib/signals/warehouse";
```

Replace line 63 (`const raw = await pullTweets(...)`) with:

```ts
  const source = getSignalSource();
  const raw = await source.pullAuthorTweets(handles, { maxPerHandle: MAX_PER_HANDLE });
  // Warehouse EVERY pulled tweet (even non-top-N, even text-less) — the dataset is the asset.
  await warehouseTweets(sb, source.id, raw);
```

Everything downstream (filter → embed → rank → candidates upsert) is unchanged — `SignalTweet` is a `CandidateInput` superset. Do NOT spread `raw` into the candidates upsert (its column list at lines 81–87 is explicit already — no change needed).

- [ ] **Step 4: Snapshot own-post metrics in the tracking cron**

In `src/app/api/cron/tracking/route.ts`, after the successful `scrapeMetrics` + posts update (line 26), append a warehouse snapshot for the own post:

```ts
import { tweetIdFromUrl } from "@/lib/signals/tweet-id";
```

and inside the success branch of the loop:

```ts
      const tid = tweetIdFromUrl(p.tweet_url);
      if (tid) {
        const { data: st } = await sb.from("signal_tweets")
          .upsert({ source: "apify", source_tweet_id: tid, author_handle: "", url: p.tweet_url, last_seen_at: new Date().toISOString() }, { onConflict: "source_tweet_id" })
          .select("id").single();
        if (st) await sb.from("tweet_metric_snapshots").insert({ signal_tweet_id: st.id, likes: m.likes, views: m.views, replies: m.replies });
      }
```

(Own posts enter the warehouse minimal; the first-hour-velocity card in P3 reads these snapshots.)

- [ ] **Step 5: Full suite + build**

Run: `npm test` → all green. `npm run build` → exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/server/targeting.ts src/app/api/cron/tracking/route.ts src/lib/signals/tweet-id.ts src/lib/signals/tweet-id.test.ts
git commit -m "feat(signals): scan + tracking ride the SignalSource adapter and feed the warehouse"
```

---

## Task 7: Activity event log

**Files:**
- Create: `src/lib/activity.ts`
- Test: `src/lib/activity.test.ts`
- Modify: `src/server/posts.ts` (`markPosted`, `markRepliedQuick`)

- [ ] **Step 1: Failing tests**

`src/lib/activity.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { logActivity } from "@/lib/activity";

describe("logActivity", () => {
  it("inserts the event row", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const sb = { from: vi.fn(() => ({ insert })) };
    await logActivity(sb as never, "prof-1", "reply_posted", { refId: "draft-9", meta: { via: "quick" } });
    expect(sb.from).toHaveBeenCalledWith("activity_events");
    expect(insert).toHaveBeenCalledWith({
      profile_id: "prof-1", kind: "reply_posted", ref_id: "draft-9", meta: { via: "quick" },
    });
  });

  it("never throws on db error", async () => {
    const sb = { from: vi.fn(() => ({ insert: vi.fn().mockResolvedValue({ error: { message: "boom" } }) })) };
    await expect(logActivity(sb as never, "p", "scan_run")).resolves.toBeUndefined();
  });
});
```

Run: `npm test -- activity` → FAIL.

- [ ] **Step 2: Implement `src/lib/activity.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";

export type ActivityKind =
  | "reply_posted" | "post_published" | "engage_done" | "draft_created"
  | "csv_imported" | "sniper_alert_sent" | "sniper_alert_acted" | "scan_run";

/**
 * Append one row to the activity ledger. Never throws — activity logging must
 * never break the user action it decorates.
 */
export async function logActivity(
  sb: SupabaseClient<Database>,
  profileId: string,
  kind: ActivityKind,
  opts?: { refId?: string; meta?: Record<string, unknown> },
): Promise<void> {
  try {
    const { error } = await sb.from("activity_events").insert({
      profile_id: profileId, kind, ref_id: opts?.refId ?? null, meta: (opts?.meta ?? {}) as Json,
    });
    if (error) console.error("[activity] insert failed:", error.message);
  } catch (err) {
    console.error("[activity] unexpected:", err);
  }
}
```

Run: `npm test -- activity` → PASS.

- [ ] **Step 3: Wire into post/reply actions**

In `src/server/posts.ts` add `import { logActivity } from "@/lib/activity";` then:

- `markPosted` — before `revalidatePath("/performance")`:

```ts
  await logActivity(sb, draft.profile_id, draft.kind === "reply" ? "reply_posted" : "post_published", { refId: draftId, meta: { tweet_url: parsed.data } });
```

- `markRepliedQuick` — before `revalidatePath("/engage")`:

```ts
  await logActivity(sb, profileId, "reply_posted", { refId: draftId, meta: { via: "quick" } });
```

Telegram `applyCallback` needs no change — it calls `markRepliedQuick`, which now logs (single source, no double-count).

- [ ] **Step 4: Full suite** — `npm test` → green (posts.ts has no unit tests today; the suite guards regressions elsewhere).

- [ ] **Step 5: Commit**

```bash
git add src/lib/activity.ts src/lib/activity.test.ts src/server/posts.ts
git commit -m "feat(activity): event ledger + wiring into markPosted/markRepliedQuick"
```

---

## Task 8: Daily follower snapshot

**Files:**
- Create: `src/server/follower-snapshot.ts`, `src/app/api/cron/follower-snapshot/route.ts`
- Test: `src/server/follower-snapshot.test.ts`

- [ ] **Step 1: Failing test for the pure extractor**

`src/server/follower-snapshot.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { latestFollowers } from "@/server/follower-snapshot";
import type { SignalTweet } from "@/lib/signals/types";

const mk = (followers: number, createdAt: string): SignalTweet => ({
  source_tweet_id: String(followers), author_handle: "me", tweet_text: "t", tweet_url: "",
  metrics_snapshot: { likes: 0, views: 0, replies: 0, authorFollowers: followers, createdAt },
});

describe("latestFollowers", () => {
  it("takes the follower count from the newest tweet", () => {
    expect(latestFollowers([mk(100, "2026-06-10T10:00:00Z"), mk(105, "2026-06-11T09:00:00Z")])).toBe(105);
  });
  it("returns null when no tweets", () => {
    expect(latestFollowers([])).toBeNull();
  });
});
```

Run: `npm test -- follower` → FAIL.

- [ ] **Step 2: Implement `src/server/follower-snapshot.ts`**

```ts
import { supabaseService } from "@/lib/supabase/server";
import { getSignalSource } from "@/lib/signals";
import type { SignalTweet } from "@/lib/signals/types";

/** Follower count from the newest pulled tweet's author metadata; null if none. */
export function latestFollowers(tweets: SignalTweet[]): number | null {
  if (tweets.length === 0) return null;
  const newest = [...tweets].sort((a, b) =>
    new Date(b.metrics_snapshot.createdAt).getTime() - new Date(a.metrics_snapshot.createdAt).getTime())[0];
  return newest.metrics_snapshot.authorFollowers || null;
}

/**
 * Capture today's follower count for a profile by pulling its own latest tweets
 * (the author metadata carries the count — zero extra vendor, ~1 actor run/day).
 * Upserts one row per (profile, day, source). Returns the count or null.
 */
export async function captureFollowerSnapshot(profileId: string): Promise<number | null> {
  const sb = supabaseService();
  const { data: profile } = await sb.from("profiles").select("handle").eq("id", profileId).single();
  if (!profile?.handle) return null;
  const tweets = await getSignalSource().pullAuthorTweets([profile.handle], { maxPerHandle: 5 });
  const followers = latestFollowers(tweets);
  if (followers === null) return null;
  const { error } = await sb.from("follower_snapshots").upsert(
    { profile_id: profileId, followers, source: "scrape" },
    { onConflict: "profile_id,snapshot_date,source" },
  );
  if (error) console.error("[follower-snapshot] upsert failed:", error.message);
  return followers;
}
```

Run: `npm test -- follower` → PASS.

- [ ] **Step 3: Cron route `src/app/api/cron/follower-snapshot/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { captureFollowerSnapshot } from "@/server/follower-snapshot";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const authError = cronAuthError(req);
  if (authError) return authError;
  const profileId = process.env.FIXED_PROFILE_ID;
  if (!profileId) return NextResponse.json({ ok: false, error: "FIXED_PROFILE_ID unset" }, { status: 500 });
  const followers = await captureFollowerSnapshot(profileId);
  return NextResponse.json({ ok: followers !== null, followers });
}
```

- [ ] **Step 4: Schedule it**

If `vercel.json` exists with a `crons` array: add `{ "path": "/api/cron/follower-snapshot", "schedule": "30 7 * * *" }`. If not, add the route to whatever currently triggers `/api/cron/targeting` (GH Actions workflow or external cron) at daily cadence — same `CRON_SECRET` bearer.

- [ ] **Step 5: Full suite + build + commit**

```bash
npm test && npm run build
git add src/server/follower-snapshot.ts src/server/follower-snapshot.test.ts src/app/api/cron/follower-snapshot/route.ts vercel.json
git commit -m "feat(followers): daily follower snapshot via SignalSource (own-tweet author metadata)"
```

---

## Task 9: Land P1 + dogfood verification

- [ ] **Step 1: Final gates** — `npm test` (419+ green, plus the ~10 new tests) and `npm run build`.

- [ ] **Step 2: Merge to main + push**

```bash
git checkout main
git merge feat/revamp-p1-signal-warehouse -m "merge: P1 signal adapter + warehouse"
npm test
git push origin main feat/revamp-p1-signal-warehouse
```

- [ ] **Step 3: Trigger one real scan + one snapshot, verify warehouse fills**

Hit `/api/cron/targeting` and `/api/cron/follower-snapshot` with the `CRON_SECRET` bearer (or wait for the scheduled run), then:

```sql
select count(*) from signal_tweets;                 -- > 0
select count(*) from tweet_metric_snapshots;        -- > 0
select * from follower_snapshots order by captured_at desc limit 1;  -- today's row
```

- [ ] **Step 4: 48h dogfood gate** — after two days of crons, `signal_tweets` count strictly growing day-over-day. Then P2 (topic board) opens.

- [ ] **Step 5: Update vault** — tick P0+P1 boxes in `cisco-brain` BACKLOG + Task file, refresh `Embalio — Next Steps`, handoff note.

---

## Self-review notes

- Spec coverage: P0 (Task 1–2), adapter + slots (4), warehouse tables incl. topic_history for P2 (3, 5, 6), activity events (7), follower snapshots (8), dogfood gates (9). `watch_targets` deliberately absent (user: wait for P5). Tier hooks/`push` are later phases.
- `applyCallback` logs via `markRepliedQuick` — single-source, avoids the double-count the spec's literal wiring list would cause.
- RLS-disabled warehouse tables follow the existing `research_briefings` pattern (trusted-local). Flagged for P7 beta hardening: revoke anon/authenticated grants or enable RLS with service-role-only policies before any external user.
