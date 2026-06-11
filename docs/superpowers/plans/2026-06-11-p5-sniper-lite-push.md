# P5 — Sniper-lite + Push Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** First-to-comment sniper — a GH-Actions poll watches 5–10 priority X handles, scores every new tweet with the vault `targetScore()` formula (2–10× band), and pushes an alert (Telegram + PWA web push via one `notify()` fan-out) within minutes, with detection latency logged to baseline the future paid tier.

**Architecture:** A new `/api/cron/sniper` route (CRON_SECRET-gated, hit by a 15-min GH-Actions workflow during waking hours) pulls lean batches (`maxPerHandle: 3`) from the existing `SignalSource`, warehouses everything, scores new fresh tweets with a pure `targetScore()` in `src/lib/sniper/score.ts`, inserts idempotent rows into a new `sniper_alerts` table, and fans out through `src/lib/notify.ts` (Telegram via existing `sendTelegram`, web push via new `web-push`-backed `src/lib/push.ts` + `public/sw.js` service worker + `push_subscriptions` table). Alerts pin on top of `/engage`. Watch-list managed via a card on `/board`.

**Tech Stack:** Next.js 15 App Router, Supabase (service-role posture, RLS-disabled warehouse tables), Vitest, `web-push` (new dep), GitHub Actions cron, existing Apify `SignalSource` + OpenAI embeddings.

**Locked decisions (owner, 2026-06-11 — do not re-litigate):**
1. **Poll cadence: 15-min lean** (`*/15 6-22 * * *` UTC, `maxPerHandle: 3`) — keeps Apify burn ~$8–15/mo inside Starter credits. Cadence lives only in the workflow cron string; tighten when revenue funds the twitterapi.io stream (funding-ladder spec decision 12).
2. **Size band standardized 2–10×** repo-wide (spec P5 row) — `sizeFit` in `scoring.ts`, `targetFollowerBand` in `knobs.ts`, `fitBadge` in `present.ts` all move from 5–20× to 2–10×.
3. **Telegram alert = plain text, no callback buttons** in v1 — acting on an alert happens on the `/engage` pinned card (avoids touching `telegram-poll.ts` offset machinery; the P0-residual nudge/Telegram work owns that file).
4. New code is `profileId`-parameterized (spec risk note); the cron iterates every profile that has active watch targets.
5. `targetScore()` formula is the vault playbook §4 (`20 - AREAS/X Growth/X Growth — Engagement Playbook.md` in cisco-brain): `0.30·relevance + 0.25·reply_velocity + 0.20·recency + 0.15·size_fit + 0.10·followback`, × bait multiplier, with hard drops (>3h unless hot, >30 replies, bait).

**Env additions (document in `.env.example`, set in Vercel + `.env.local` at dogfood):**
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (e.g. `mailto:cisco.vieira25@gmail.com`) — generate with `npx web-push generate-vapid-keys`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (same value as `VAPID_PUBLIC_KEY`, exposed to client)
- `SNIPER_MIN_SCORE` (optional, default `0.6`)

**Exit gate:** suite ≥545 green (`npm test`), `npm run build` green, live-fire: one real alert lands on the phone (Telegram + web push) with a `latency_ms` row in `sniper_alerts`.

---

### Task 1: Migration — `watch_targets`, `sniper_alerts`, `push_subscriptions` + hand-reflected types

**Files:**
- Create: `supabase/migrations/20260613_sniper.sql`
- Modify: `src/lib/supabase/types.ts` (add three table types alongside existing warehouse tables)

No unit test for raw SQL (house pattern: migrations are verified by application at dogfood; types are checked by `tsc` once consumers land).

- [ ] **Step 1: Write the migration**

```sql
-- P5 sniper-lite: watch list, alert ledger, web-push subscriptions.
-- Same service-role posture as the signal warehouse (RLS disabled; P7 hardening item).

create table if not exists watch_targets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  handle text not null,
  priority int not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (profile_id, handle)
);
create index if not exists watch_targets_profile_idx on watch_targets (profile_id) where active;
alter table watch_targets disable row level security;

create table if not exists sniper_alerts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  source_tweet_id text not null,
  author_handle text not null,
  tweet_text text not null,
  tweet_url text not null,
  score numeric not null,
  score_parts jsonb not null default '{}'::jsonb,
  latency_ms bigint not null,
  channels jsonb not null default '{}'::jsonb,
  status text not null default 'sent' check (status in ('sent','acted','dismissed')),
  created_at timestamptz not null default now(),
  unique (profile_id, source_tweet_id)
);
create index if not exists sniper_alerts_profile_recent_idx on sniper_alerts (profile_id, created_at desc);
alter table sniper_alerts disable row level security;

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table push_subscriptions disable row level security;
```

- [ ] **Step 2: Hand-reflect into `src/lib/supabase/types.ts`**

Add inside the `Tables` object, following the exact Row/Insert/Update shape of the existing `analytics_daily` entry (all defaulted columns optional in Insert):

```typescript
      watch_targets: {
        Row: {
          id: string;
          profile_id: string;
          handle: string;
          priority: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          handle: string;
          priority?: number;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          handle?: string;
          priority?: number;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      sniper_alerts: {
        Row: {
          id: string;
          profile_id: string;
          source_tweet_id: string;
          author_handle: string;
          tweet_text: string;
          tweet_url: string;
          score: number;
          score_parts: Json;
          latency_ms: number;
          channels: Json;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          source_tweet_id: string;
          author_handle: string;
          tweet_text: string;
          tweet_url: string;
          score: number;
          score_parts?: Json;
          latency_ms: number;
          channels?: Json;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          source_tweet_id?: string;
          author_handle?: string;
          tweet_text?: string;
          tweet_url?: string;
          score?: number;
          score_parts?: Json;
          latency_ms?: number;
          channels?: Json;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          profile_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
```

(If the existing entries carry `Relationships` arrays with FK metadata, mirror that style; if they use `Relationships: []`, keep `[]`.)

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: same baseline as before this task (note: `src/server/topics.test.ts` has a pre-existing TS2556 error — unchanged count is the bar, no NEW errors).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260613_sniper.sql src/lib/supabase/types.ts
git commit -m "feat(sniper): watch_targets + sniper_alerts + push_subscriptions schema"
```

> **Live DB note:** applying the migration to Supabase project `vzxpakxjnuaesfxihyvl` happens in Task 12 (owner-gated dogfood), via Supabase MCP `apply_migration` — same flow P3 used.

---

### Task 2: Standardize size band to 2–10× repo-wide

**Files:**
- Modify: `src/lib/scoring.ts` (lines 5, 24–31 — `sizeFit`)
- Modify: `src/lib/engagement/knobs.ts` (line 47 — `targetFollowerBand`)
- Modify: `src/lib/engagement/present.ts` (lines 3–11 — `fitBadge`)
- Test: `src/lib/scoring.test.ts`, `src/lib/engagement/present.test.ts`, `src/lib/engagement/knobs.test.ts` (update existing expectations; add band-edge cases)

- [ ] **Step 1: Update/add failing tests for the new band**

In `src/lib/scoring.test.ts`, update any 5–20× expectations and add:

```typescript
import { sizeFit } from "@/lib/scoring";

describe("sizeFit — 2-10x band (playbook §4)", () => {
  it("gives full credit inside 2-10x", () => {
    expect(sizeFit(2_600, 1_300)).toBe(1);   // 2x
    expect(sizeFit(13_000, 1_300)).toBe(1);  // 10x
  });
  it("ramps below 2x and decays above 10x", () => {
    expect(sizeFit(1_300, 1_300)).toBeCloseTo(0.5);   // 1x → ratio/2
    expect(sizeFit(130_000, 1_300)).toBeCloseTo(0.1); // 100x → 10/ratio
  });
});
```

In `src/lib/engagement/present.test.ts` (update existing in-band fixtures to the new band):

```typescript
import { fitBadge } from "@/lib/engagement/present";

describe("fitBadge — 2-10x band", () => {
  it("labels 2-10x as in band", () => {
    expect(fitBadge(6_500, 1_300)).toEqual({ label: "5× your size · in band", inBand: true });
  });
  it("labels >10x as a visibility play", () => {
    expect(fitBadge(130_000, 1_300).inBand).toBe(false);
  });
});
```

In `src/lib/engagement/knobs.test.ts`, update the band expectation:

```typescript
expect(knobsFromProfile({ account_size: "500-5k", daily_capacity: "30m", north_star_metric: null, reply_playbook: null }).targetFollowerBand)
  .toEqual({ min: 5500, max: 27500 }); // 2750 × 2 / × 10
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/scoring.test.ts src/lib/engagement/present.test.ts src/lib/engagement/knobs.test.ts`
Expected: FAIL on the new band expectations (old code returns 5–20× values).

- [ ] **Step 3: Implement the band change**

`src/lib/scoring.ts` — replace `sizeFit` (keep export):

```typescript
// 1.0 inside the 2-10x band (playbook §4: ride out-of-network reach without
// being buried); ramps from 0 below 2x, decays toward 0 above 10x.
export function sizeFit(authorFollowers: number, ownerEstimate: number): number {
  if (ownerEstimate <= 0 || authorFollowers <= 0) return 1;
  const ratio = authorFollowers / ownerEstimate;
  if (ratio < 2) return clamp01(ratio / 2);
  if (ratio > 10) return clamp01(10 / ratio);
  return 1;
}
```

(Also update the stale `// for the 5-20x size-fit rule` comment on `ScoreInputs.authorFollowers` to `// for the 2-10x size-fit rule`.)

`src/lib/engagement/knobs.ts` line 47:

```typescript
    targetFollowerBand: { min: ownerFollowerEstimate * 2, max: ownerFollowerEstimate * 10 },
```

`src/lib/engagement/present.ts` — replace `fitBadge` body band check:

```typescript
export function fitBadge(authorFollowers: number, ownerEstimate: number): FitBadge {
  if (!ownerEstimate || ownerEstimate <= 0 || !authorFollowers) {
    return { label: "size unknown", inBand: false };
  }
  const ratio = authorFollowers / ownerEstimate;
  if (ratio >= 2 && ratio <= 10) return { label: `${Math.round(ratio)}× your size · in band`, inBand: true };
  if (ratio > 10) return { label: "big acct · visibility play", inBand: false };
  return { label: `${ratio.toFixed(1)}× · small`, inBand: false };
}
```

- [ ] **Step 4: Run the FULL suite (band change ripples into targeting/engage tests)**

Run: `npm test`
Expected: all green. If `targeting.test.ts` `"inband"` fixture (25,000 followers vs owner 2,750 ≈ 9×) or similar fixtures now sit differently in the band, fix the FIXTURE values to stay in/out of band as the test intends — do not weaken assertions.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.ts src/lib/engagement/knobs.ts src/lib/engagement/present.ts src/lib/scoring.test.ts src/lib/engagement/present.test.ts src/lib/engagement/knobs.test.ts src/server/targeting.test.ts
git commit -m "feat(scoring): standardize size-fit band to 2-10x per playbook §4"
```

---

### Task 3: Pure `targetScore()` — `src/lib/sniper/score.ts`

**Files:**
- Create: `src/lib/sniper/score.ts`
- Test: `src/lib/sniper/score.test.ts`

The vault playbook §4 formula, productized. Weighted sum (not multipliers like `compositeScore`) so each part is inspectable in `score_parts`; bait stays a multiplier (it's a quality gate, not a ranking dimension).

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from "vitest";
import { targetScore, type TargetScoreInputs } from "@/lib/sniper/score";

const base: TargetScoreInputs = {
  relevance: 0.8,
  ageMinutes: 20,
  replyCount: 8,
  repliesPerHour: 24,
  authorFollowers: 6_500,
  ownerFollowers: 1_300,   // 5x → in 2-10 band
  bait: 1,
};

describe("targetScore — playbook §4 formula", () => {
  it("scores a fresh, fast, in-band, relevant post high with no drop", () => {
    const r = targetScore(base);
    expect(r.drop).toBeNull();
    expect(r.score).toBeGreaterThan(0.7);
    expect(r.parts.sizeFit).toBe(1);
    expect(r.parts.recency).toBe(1); // inside the 0-60 min gold window
  });

  it("weights relevance highest", () => {
    const high = targetScore(base);
    const low = targetScore({ ...base, relevance: 0.1 });
    expect(high.score - low.score).toBeGreaterThan(0.15); // 0.30 weight × 0.7 delta ≈ 0.21
  });

  it("hard-drops >30 replies (can't land top-5)", () => {
    expect(targetScore({ ...base, replyCount: 31 }).drop).toBe("crowded");
  });

  it("hard-drops >3h old unless still visibly hot", () => {
    expect(targetScore({ ...base, ageMinutes: 200, repliesPerHour: 4 }).drop).toBe("stale");
    expect(targetScore({ ...base, ageMinutes: 200, repliesPerHour: 25, replyCount: 20 }).drop).toBeNull();
  });

  it("hard-drops engagement bait", () => {
    expect(targetScore({ ...base, bait: 0.2 }).drop).toBe("bait");
  });

  it("decays recency linearly after the gold window", () => {
    const at60 = targetScore({ ...base, ageMinutes: 60 }).parts.recency;
    const at120 = targetScore({ ...base, ageMinutes: 120 }).parts.recency;
    expect(at60).toBe(1);
    expect(at120).toBeCloseTo(0.5);
  });

  it("gives followback credit to peers, less to bigger accounts", () => {
    const peer = targetScore({ ...base, authorFollowers: 1_300 }); // 1x
    const big = targetScore({ ...base, authorFollowers: 13_000 }); // 10x
    expect(peer.parts.followback).toBe(1);
    expect(big.parts.followback).toBeCloseTo(0.2);
  });

  it("survives zero/unknown owner followers without NaN", () => {
    const r = targetScore({ ...base, ownerFollowers: 0 });
    expect(Number.isFinite(r.score)).toBe(true);
    expect(r.parts.sizeFit).toBe(1); // unknown size = neutral, matches sizeFit convention
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/sniper/score.test.ts`
Expected: FAIL — `Cannot find module '@/lib/sniper/score'`.

- [ ] **Step 3: Implement**

```typescript
/**
 * The vault target-score formula, productized (X Growth — Engagement Playbook §4):
 *
 *   score = 0.30·relevance + 0.25·reply_velocity + 0.20·recency
 *         + 0.15·size_fit(2-10x) + 0.10·followback,  × bait multiplier
 *
 * Hard drops (playbook §4 penalties): >30 replies (can't land top-5),
 * >3h old unless still visibly hot, engagement bait. Weighted-sum (not
 * multiplier) form so every part is inspectable in sniper_alerts.score_parts.
 */
export interface TargetScoreInputs {
  relevance: number;       // 0..1 (embedding similarity vs niche/voice)
  ageMinutes: number;
  replyCount: number;
  repliesPerHour: number;
  authorFollowers: number;
  ownerFollowers: number;  // real count (follower_snapshots), not bucket estimate
  bait: number;            // 0..1 from baitScore() — 1 clean, →0 baity
}

export interface TargetScoreParts {
  relevance: number;
  velocity: number;
  recency: number;
  sizeFit: number;
  followback: number;
}

export type TargetDropReason = "stale" | "crowded" | "bait";

export interface TargetScoreResult {
  score: number;                  // 0..1
  parts: TargetScoreParts;
  drop: TargetDropReason | null;  // non-null = never alert, regardless of score
}

const W = { relevance: 0.3, velocity: 0.25, recency: 0.2, sizeFit: 0.15, followback: 0.1 };
const GOLD_WINDOW_MIN = 60;       // 0-60 min is gold (full recency credit)
const STALE_MIN = 180;            // >3h = hard drop…
const HOT_REPLIES_PER_HOUR = 20;  // …unless still visibly hot
const CROWD_DROP_REPLIES = 30;    // >~30 replies: can't land top-5
const BAIT_DROP = 0.4;            // baitScore below this = farm content, skip
const VELOCITY_SATURATION = 40;   // replies/hr ≈ "20 replies in 30 min" maps near 1.0

// 2-10x band: full credit riding a bigger account's out-of-network reach.
function sniperSizeFit(authorFollowers: number, ownerFollowers: number): number {
  if (ownerFollowers <= 0 || authorFollowers <= 0) return 1; // unknown = neutral
  const ratio = authorFollowers / ownerFollowers;
  if (ratio < 2) return clamp01(ratio / 2);
  if (ratio > 10) return clamp01(10 / ratio);
  return 1;
}

// Peers (<2x) carry reciprocal-follow value; decays as the gap grows.
function followbackCredit(authorFollowers: number, ownerFollowers: number): number {
  if (ownerFollowers <= 0 || authorFollowers <= 0) return 0.5; // unknown = neutral-ish
  const ratio = authorFollowers / ownerFollowers;
  if (ratio <= 2) return 1;
  return clamp01(2 / ratio);
}

export function targetScore(i: TargetScoreInputs): TargetScoreResult {
  const parts: TargetScoreParts = {
    relevance: clamp01(i.relevance),
    velocity: clamp01(1 - Math.exp(-Math.max(0, i.repliesPerHour) / VELOCITY_SATURATION)),
    recency:
      i.ageMinutes <= GOLD_WINDOW_MIN
        ? 1
        : clamp01(1 - (i.ageMinutes - GOLD_WINDOW_MIN) / (STALE_MIN - GOLD_WINDOW_MIN)),
    sizeFit: sniperSizeFit(i.authorFollowers, i.ownerFollowers),
    followback: followbackCredit(i.authorFollowers, i.ownerFollowers),
  };

  let drop: TargetDropReason | null = null;
  if (i.replyCount > CROWD_DROP_REPLIES) drop = "crowded";
  else if (i.ageMinutes > STALE_MIN && i.repliesPerHour < HOT_REPLIES_PER_HOUR) drop = "stale";
  else if (i.bait < BAIT_DROP) drop = "bait";

  const weighted =
    W.relevance * parts.relevance +
    W.velocity * parts.velocity +
    W.recency * parts.recency +
    W.sizeFit * parts.sizeFit +
    W.followback * parts.followback;

  return { score: clamp01(weighted * clamp01(i.bait)), parts, drop };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/sniper/score.test.ts`
Expected: PASS (all 8).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sniper/score.ts src/lib/sniper/score.test.ts
git commit -m "feat(sniper): pure targetScore() — playbook §4 formula, 2-10x band"
```

---

### Task 4: Web push primitive — `web-push` dep, `src/lib/push.ts`, `public/sw.js`

**Files:**
- Modify: `package.json` (deps)
- Create: `src/lib/push.ts`
- Create: `public/sw.js`
- Modify: `.env.example` (document VAPID vars)
- Test: `src/lib/push.test.ts`

- [ ] **Step 1: Install dependency**

Run: `npm install web-push && npm install -D @types/web-push`
Expected: clean install, lockfile updated.

- [ ] **Step 2: Write the failing test**

`src/lib/push.test.ts` — test config gating and 404/410 pruning signal without real network (inject the webpush impl):

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendWebPush, PushSubscriptionGone, type WebPushSub } from "@/lib/push";

const sub: WebPushSub = { endpoint: "https://push.example/abc", p256dh: "k1", auth: "k2" };
const payload = { title: "t", body: "b", url: "/engage" };

beforeEach(() => {
  process.env.VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
  process.env.VAPID_SUBJECT = "mailto:test@example.com";
});

describe("sendWebPush", () => {
  it("throws a clear error when VAPID env is missing", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    await expect(sendWebPush(sub, payload)).rejects.toThrow(/VAPID/);
  });

  it("sends the JSON payload to the subscription endpoint", async () => {
    const impl = { setVapidDetails: vi.fn(), sendNotification: vi.fn().mockResolvedValue({ statusCode: 201 }) };
    await sendWebPush(sub, payload, impl);
    expect(impl.sendNotification).toHaveBeenCalledWith(
      { endpoint: sub.endpoint, keys: { p256dh: "k1", auth: "k2" } },
      JSON.stringify(payload),
    );
  });

  it("converts 410 Gone into PushSubscriptionGone so callers can prune", async () => {
    const impl = {
      setVapidDetails: vi.fn(),
      sendNotification: vi.fn().mockRejectedValue(Object.assign(new Error("gone"), { statusCode: 410 })),
    };
    await expect(sendWebPush(sub, payload, impl)).rejects.toBeInstanceOf(PushSubscriptionGone);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/push.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `src/lib/push.ts`**

```typescript
import webpush from "web-push";

/** Minimal web-push surface, injectable for tests. */
export interface WebPushImpl {
  setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  sendNotification(
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string,
  ): Promise<unknown>;
}

export interface WebPushSub {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface WebPushPayload {
  title: string;
  body: string;
  url?: string;
}

/** Subscription is dead (404/410) — caller should delete it from push_subscriptions. */
export class PushSubscriptionGone extends Error {
  constructor(public readonly endpoint: string) {
    super(`push subscription gone: ${endpoint}`);
  }
}

function vapid(): { subject: string; publicKey: string; privateKey: string } {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    throw new Error("VAPID_SUBJECT, VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set");
  }
  return { subject, publicKey, privateKey };
}

export async function sendWebPush(
  sub: WebPushSub,
  payload: WebPushPayload,
  impl: WebPushImpl = webpush,
): Promise<void> {
  const v = vapid();
  impl.setVapidDetails(v.subject, v.publicKey, v.privateKey);
  try {
    await impl.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    );
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) throw new PushSubscriptionGone(sub.endpoint);
    throw err;
  }
}
```

- [ ] **Step 5: Create `public/sw.js`** (plain JS service worker — not bundled, not unit-tested; verified at dogfood)

```javascript
/* Embalio service worker: web-push display + click-through. */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Embalio", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Embalio", {
      body: data.body || "",
      icon: "/icon",
      badge: "/icon",
      data: { url: data.url || "/engage" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/engage";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    }),
  );
});
```

- [ ] **Step 6: Document env vars in `.env.example`** (append)

```env
# Web push (P5 sniper) — generate with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
SNIPER_MIN_SCORE=0.6
```

- [ ] **Step 7: Run tests + build**

Run: `npx vitest run src/lib/push.test.ts && npm run build`
Expected: tests PASS; build green (sw.js is a static asset, no bundling impact).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/lib/push.ts src/lib/push.test.ts public/sw.js .env.example
git commit -m "feat(push): web-push primitive + service worker + VAPID env"
```

---

### Task 5: Unified `notify()` fan-out — `src/lib/notify.ts`

**Files:**
- Create: `src/lib/notify.ts`
- Test: `src/lib/notify.test.ts`

Channel-isolated: one channel failing (or unconfigured) never blocks the other. All I/O injected via deps — the lib stays pure-testable; server wiring happens in Task 7.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect, vi } from "vitest";
import { notify, type NotifyDeps } from "@/lib/notify";
import { PushSubscriptionGone } from "@/lib/push";

const payload = { title: "🎯 Sniper", body: "@big just posted", url: "/engage" };
const subs = [
  { endpoint: "https://p/1", p256dh: "a", auth: "b" },
  { endpoint: "https://p/2", p256dh: "c", auth: "d" },
];

function deps(overrides: Partial<NotifyDeps> = {}): NotifyDeps {
  return {
    sendTelegram: vi.fn().mockResolvedValue(undefined),
    loadPushSubs: vi.fn().mockResolvedValue(subs),
    sendPush: vi.fn().mockResolvedValue(undefined),
    prunePushSub: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("notify — unified fan-out", () => {
  it("sends to telegram and every push subscription", async () => {
    const d = deps();
    const r = await notify("profile-1", payload, d);
    expect(d.sendTelegram).toHaveBeenCalledOnce();
    expect(d.sendPush).toHaveBeenCalledTimes(2);
    expect(r).toEqual({ telegram: "sent", push: { sent: 2, failed: 0, pruned: 0 } });
  });

  it("telegram failure does not block push (and vice versa)", async () => {
    const d = deps({ sendTelegram: vi.fn().mockRejectedValue(new Error("tg down")) });
    const r = await notify("profile-1", payload, d);
    expect(r.telegram).toBe("failed");
    expect(r.push.sent).toBe(2);
  });

  it("skips telegram when no sender configured", async () => {
    const d = deps({ sendTelegram: undefined });
    const r = await notify("profile-1", payload, d);
    expect(r.telegram).toBe("skipped");
  });

  it("prunes dead subscriptions on PushSubscriptionGone and keeps going", async () => {
    const d = deps({
      sendPush: vi
        .fn()
        .mockRejectedValueOnce(new PushSubscriptionGone("https://p/1"))
        .mockResolvedValueOnce(undefined),
    });
    const r = await notify("profile-1", payload, d);
    expect(d.prunePushSub).toHaveBeenCalledWith("https://p/1");
    expect(r.push).toEqual({ sent: 1, failed: 0, pruned: 1 });
  });

  it("counts non-Gone push errors as failed without throwing", async () => {
    const d = deps({ sendPush: vi.fn().mockRejectedValue(new Error("boom")) });
    const r = await notify("profile-1", payload, d);
    expect(r.push).toEqual({ sent: 0, failed: 2, pruned: 0 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/notify.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/notify.ts`**

```typescript
import { PushSubscriptionGone, type WebPushPayload, type WebPushSub } from "@/lib/push";

/**
 * Unified alert fan-out (spec decision 6: Telegram AND PWA web push).
 * Channel-isolated: a failing/unconfigured channel never blocks the other.
 * All I/O is injected — server code wires real deps, tests wire mocks.
 */
export interface NotifyPayload extends WebPushPayload {
  /** Pre-formatted Telegram text; falls back to `${title}\n${body}` when absent. */
  telegramText?: string;
}

export interface NotifyDeps {
  /** Omit (undefined) when Telegram is not configured for this deployment. */
  sendTelegram?: (text: string) => Promise<void>;
  loadPushSubs: (profileId: string) => Promise<WebPushSub[]>;
  sendPush: (sub: WebPushSub, payload: WebPushPayload) => Promise<void>;
  prunePushSub: (endpoint: string) => Promise<void>;
}

export interface NotifyResult {
  telegram: "sent" | "failed" | "skipped";
  push: { sent: number; failed: number; pruned: number };
}

export async function notify(
  profileId: string,
  payload: NotifyPayload,
  deps: NotifyDeps,
): Promise<NotifyResult> {
  const result: NotifyResult = { telegram: "skipped", push: { sent: 0, failed: 0, pruned: 0 } };

  const telegramWork = (async () => {
    if (!deps.sendTelegram) return;
    try {
      await deps.sendTelegram(payload.telegramText ?? `${payload.title}\n${payload.body}`);
      result.telegram = "sent";
    } catch (err) {
      console.error("[notify] telegram failed:", err);
      result.telegram = "failed";
    }
  })();

  const pushWork = (async () => {
    let subs: WebPushSub[] = [];
    try {
      subs = await deps.loadPushSubs(profileId);
    } catch (err) {
      console.error("[notify] loading push subs failed:", err);
      return;
    }
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await deps.sendPush(sub, { title: payload.title, body: payload.body, url: payload.url });
          result.push.sent++;
        } catch (err) {
          if (err instanceof PushSubscriptionGone) {
            result.push.pruned++;
            await deps.prunePushSub(sub.endpoint).catch((e) =>
              console.error("[notify] prune failed:", e),
            );
          } else {
            console.error("[notify] push failed:", err);
            result.push.failed++;
          }
        }
      }),
    );
  })();

  await Promise.all([telegramWork, pushWork]);
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/notify.test.ts`
Expected: PASS (all 5).

- [ ] **Step 5: Commit**

```bash
git add src/lib/notify.ts src/lib/notify.test.ts
git commit -m "feat(notify): unified telegram + web-push fan-out with channel isolation"
```

---

### Task 6: Push subscription persistence + opt-in UI

**Files:**
- Create: `src/server/push-subscriptions.ts`
- Create: `src/components/push-opt-in.tsx`
- Modify: `src/app/(app)/engage/page.tsx` (mount the opt-in next to the Engage tab content)
- Test: `src/server/push-subscriptions.test.ts`

- [ ] **Step 1: Write the failing server-action test**

`src/server/push-subscriptions.test.ts` (mirror the house `vi.mock` boundary style — mock the supabase module):

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const upsert = vi.fn().mockResolvedValue({ error: null });
const del = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
vi.mock("@/lib/supabase/server", () => ({
  supabaseService: () => ({
    from: vi.fn((table: string) => {
      if (table !== "push_subscriptions") throw new Error(`unexpected table ${table}`);
      return { upsert, delete: del };
    }),
  }),
}));

import { savePushSubscription, removePushSubscription } from "@/server/push-subscriptions";

beforeEach(() => {
  upsert.mockClear();
  del.mockClear();
});

describe("push subscription persistence", () => {
  it("upserts on endpoint so re-subscribing the same browser is idempotent", async () => {
    await savePushSubscription("profile-1", {
      endpoint: "https://p/1",
      p256dh: "a",
      auth: "b",
      userAgent: "x",
    });
    expect(upsert).toHaveBeenCalledWith(
      { profile_id: "profile-1", endpoint: "https://p/1", p256dh: "a", auth: "b", user_agent: "x" },
      { onConflict: "endpoint" },
    );
  });

  it("removes by endpoint", async () => {
    await removePushSubscription("https://p/1");
    expect(del).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/push-subscriptions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/server/push-subscriptions.ts`**

```typescript
"use server";
import { supabaseService } from "@/lib/supabase/server";

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}

export async function savePushSubscription(
  profileId: string,
  sub: PushSubscriptionInput,
): Promise<void> {
  const sb = supabaseService();
  const { error } = await sb.from("push_subscriptions").upsert(
    {
      profile_id: profileId,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      user_agent: sub.userAgent ?? null,
    },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(`saving push subscription failed: ${error.message}`);
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const sb = supabaseService();
  const { error } = await sb.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) throw new Error(`removing push subscription failed: ${error.message}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/push-subscriptions.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the opt-in client component** (no unit test — browser-API component, verified at dogfood; house pattern for thin client shells)

`src/components/push-opt-in.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { savePushSubscription } from "@/server/push-subscriptions";

type PushState = "checking" | "unsupported" | "denied" | "ready" | "subscribed" | "error";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function PushOptIn({ profileId }: { profileId: string }) {
  const [state, setState] = useState<PushState>("checking");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "subscribed" : "ready"))
      .catch(() => setState("error"));
  }, []);

  async function subscribe() {
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        setState("error");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      const json = sub.toJSON();
      await savePushSubscription(profileId, {
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent,
      });
      setState("subscribed");
    } catch (err) {
      console.error("push subscribe failed:", err);
      setState("error");
    }
  }

  if (state !== "ready") return null; // quiet unless there's an action to take
  return (
    <button
      onClick={subscribe}
      className="text-[12px] px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
    >
      🔔 Enable sniper alerts on this device
    </button>
  );
}
```

- [ ] **Step 6: Mount on the Engage page**

In `src/app/(app)/engage/page.tsx`, add the import and render it inside the `activeTab === "engage"` block, just above the existing `<p>` description:

```tsx
import { PushOptIn } from "@/components/push-opt-in";
```

```tsx
      {activeTab === "engage" && (
        <>
          {profiles[0] && (
            <div className="mb-3">
              <PushOptIn profileId={profiles[0].id} />
            </div>
          )}
          <p className="text-[13px] text-muted-foreground mb-4">
            Scan seed accounts and draft replies in one step.
          </p>
          <EngageQueuePanel profiles={profiles} initialItems={initialItems} />
        </>
      )}
```

- [ ] **Step 7: Build + full suite**

Run: `npm test && npm run build`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add src/server/push-subscriptions.ts src/server/push-subscriptions.test.ts src/components/push-opt-in.tsx "src/app/(app)/engage/page.tsx"
git commit -m "feat(push): subscription persistence + engage-page opt-in"
```

---

### Task 7: The sniper poll — `src/server/sniper.ts`

**Files:**
- Create: `src/server/sniper.ts`
- Test: `src/server/sniper.test.ts`

Pipeline per profile: load watch list → lean pull → warehouse → pre-filter (text, ≤3h) → embed relevance → real owner followers → `targetScore` → idempotent alert insert → `notify()` → activity log. Latency = `created_at(alert) − tweet_created_at` — the paid-tier baseline metric.

- [ ] **Step 1: Write the failing test for the pure ranking/decision helper**

Keep the testable core pure (house pattern: `rankCandidates` style). Test `pickAlerts`:

```typescript
import { describe, it, expect } from "vitest";
import { pickAlerts, type SniperCandidate } from "@/server/sniper";

const now = Date.now();
function cand(id: string, opts: Partial<SniperCandidate> = {}): SniperCandidate {
  return {
    source_tweet_id: id,
    author_handle: "big",
    tweet_text: "Shipped a per-user spend cap today — here's the failure mode I hit.",
    tweet_url: `https://x.com/big/status/${id}`,
    metrics_snapshot: {
      likes: 30,
      views: 900,
      replies: 8,
      authorFollowers: 6_500,
      createdAt: new Date(now - 20 * 60_000).toISOString(), // 20 min old
    },
    ...opts,
  };
}

describe("pickAlerts", () => {
  it("keeps fresh, scoring candidates above the threshold, ordered by score", () => {
    const picked = pickAlerts([cand("1"), cand("2")], (c) => (c.source_tweet_id === "1" ? 0.9 : 0.7), 1_300, 0.6, 3, now);
    expect(picked.map((p) => p.source_tweet_id)).toEqual(["1", "2"]);
    expect(picked[0].score).toBeGreaterThan(picked[1].score);
    expect(picked[0].latencyMs).toBeCloseTo(20 * 60_000, -3);
  });

  it("drops below-threshold and hard-dropped candidates", () => {
    const stale = cand("old", {
      metrics_snapshot: { likes: 2, views: 50, replies: 2, authorFollowers: 6_500, createdAt: new Date(now - 5 * 3600_000).toISOString() },
    });
    const crowded = cand("crowd", {
      metrics_snapshot: { likes: 500, views: 9000, replies: 80, authorFollowers: 6_500, createdAt: new Date(now - 20 * 60_000).toISOString() },
    });
    const picked = pickAlerts([stale, crowded, cand("good")], () => 0.9, 1_300, 0.6, 3, now);
    expect(picked.map((p) => p.source_tweet_id)).toEqual(["good"]);
  });

  it("caps alerts per poll", () => {
    const picked = pickAlerts([cand("1"), cand("2"), cand("3")], () => 0.9, 1_300, 0.6, 2, now);
    expect(picked).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/sniper.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/server/sniper.ts`**

```typescript
import { supabaseService } from "@/lib/supabase/server";
import { getSignalSource } from "@/lib/signals";
import { warehouseTweets } from "@/lib/signals/warehouse";
import { embedText, embedTexts, relevanceFromVectors } from "@/lib/embeddings";
import { targetScore, type TargetScoreParts } from "@/lib/sniper/score";
import { baitScore } from "@/lib/engagement/bait";
import { knobsFromProfile } from "@/lib/engagement/knobs";
import { notify } from "@/lib/notify";
import { sendTelegram } from "@/lib/telegram";
import { sendWebPush } from "@/lib/push";
import { logActivity } from "@/lib/activity";
import type { CandidateInput } from "@/lib/apify";
import type { Json } from "@/lib/supabase/types";

const MAX_PER_HANDLE = 3;        // lean pull — owner-locked 15-min cadence budget
const MAX_WATCH_HANDLES = 10;    // spec: 5-10 priority handles (paid-tier lever later)
const ALERT_CAP_PER_POLL = 3;    // don't machine-gun the phone
const FRESH_WINDOW_MIN = 180;    // playbook: >3h is dead for first-to-comment

export type SniperCandidate = CandidateInput;

export interface PickedAlert {
  source_tweet_id: string;
  author_handle: string;
  tweet_text: string;
  tweet_url: string;
  score: number;
  parts: TargetScoreParts;
  latencyMs: number;
  ageMinutes: number;
  replies: number;
}

/** Pure decision core: score fresh candidates, drop hard-drops, threshold, cap. */
export function pickAlerts(
  cands: SniperCandidate[],
  relevanceOf: (c: SniperCandidate) => number,
  ownerFollowers: number,
  minScore: number,
  cap: number,
  nowMs: number,
): PickedAlert[] {
  const picked: PickedAlert[] = [];
  for (const c of cands) {
    const createdMs = new Date(c.metrics_snapshot.createdAt).getTime();
    if (Number.isNaN(createdMs)) continue;
    const ageMinutes = Math.max(0, (nowMs - createdMs) / 60_000);
    if (ageMinutes > FRESH_WINDOW_MIN) continue; // cheap pre-filter (stale-but-hot is the scan's job, not the sniper's)
    const repliesPerHour = c.metrics_snapshot.replies / Math.max(1 / 60, ageMinutes / 60);
    const r = targetScore({
      relevance: relevanceOf(c),
      ageMinutes,
      replyCount: c.metrics_snapshot.replies,
      repliesPerHour,
      authorFollowers: c.metrics_snapshot.authorFollowers,
      ownerFollowers,
      bait: baitScore(c.tweet_text),
    });
    if (r.drop || r.score < minScore) continue;
    picked.push({
      source_tweet_id: c.source_tweet_id,
      author_handle: c.author_handle,
      tweet_text: c.tweet_text,
      tweet_url: c.tweet_url,
      score: r.score,
      parts: r.parts,
      latencyMs: Math.round(nowMs - createdMs),
      ageMinutes: Math.round(ageMinutes),
      replies: c.metrics_snapshot.replies,
    });
  }
  return picked.sort((a, b) => b.score - a.score).slice(0, cap);
}

function alertTelegramText(a: PickedAlert): string {
  const body = a.tweet_text.length > 220 ? `${a.tweet_text.slice(0, 220)}…` : a.tweet_text;
  return [
    `🎯 Sniper: @${a.author_handle} — ${a.ageMinutes}m old · ${a.replies} replies · score ${Math.round(a.score * 100)}`,
    body,
    a.tweet_url,
  ].join("\n");
}

/**
 * One poll for one profile. Cloud-safe (signal source + embeddings + pure
 * scoring — no claude). Returns counts for the cron response.
 */
export async function runSniperPoll(profileId: string): Promise<{ pulled: number; alerts: number }> {
  const sb = supabaseService();
  const { data: profile } = await sb.from("profiles").select("*").eq("id", profileId).single();
  if (!profile) return { pulled: 0, alerts: 0 };

  const { data: targets } = await sb
    .from("watch_targets")
    .select("handle")
    .eq("profile_id", profileId)
    .eq("active", true)
    .order("priority", { ascending: false })
    .limit(MAX_WATCH_HANDLES);
  const handles = (targets ?? []).map((t) => t.handle).filter(Boolean);
  if (handles.length === 0) return { pulled: 0, alerts: 0 };

  const source = getSignalSource();
  const raw = await source.pullAuthorTweets(handles, { maxPerHandle: MAX_PER_HANDLE });
  await warehouseTweets(sb, source.id, raw); // dataset is the asset — warehouse everything

  const now = Date.now();
  const fresh = raw.filter(
    (r) =>
      r.tweet_text.trim().length > 0 &&
      now - new Date(r.metrics_snapshot.createdAt).getTime() <= FRESH_WINDOW_MIN * 60_000,
  );
  if (fresh.length === 0) return { pulled: raw.length, alerts: 0 };

  // Skip anything already alerted (idempotency pre-check; the unique constraint
  // is the backstop against poll races).
  const { data: existing } = await sb
    .from("sniper_alerts")
    .select("source_tweet_id")
    .eq("profile_id", profileId)
    .in("source_tweet_id", fresh.map((f) => f.source_tweet_id));
  const seen = new Set((existing ?? []).map((e) => e.source_tweet_id));
  const candidates = fresh.filter((f) => !seen.has(f.source_tweet_id));
  if (candidates.length === 0) return { pulled: raw.length, alerts: 0 };

  const voiceVec = await embedText(
    [profile.niche_description, ...((profile.content_pillars ?? []) as string[]), ...profile.voice_corpus]
      .filter(Boolean)
      .join(" "),
  );
  const tweetVecs = await embedTexts(candidates.map((c) => c.tweet_text));
  const relevanceById = new Map(
    candidates.map((c, i) => [c.source_tweet_id, relevanceFromVectors(voiceVec, tweetVecs[i])]),
  );

  // Real follower count beats the bucket estimate when we have it.
  const { data: snap } = await sb
    .from("follower_snapshots")
    .select("followers")
    .eq("profile_id", profileId)
    .order("snapshot_date", { ascending: false })
    .limit(1);
  const ownerFollowers = snap?.[0]?.followers ?? knobsFromProfile(profile).ownerFollowerEstimate;

  const minScore = Number(process.env.SNIPER_MIN_SCORE ?? "0.6");
  const picked = pickAlerts(
    candidates,
    (c) => relevanceById.get(c.source_tweet_id) ?? 0,
    ownerFollowers,
    minScore,
    ALERT_CAP_PER_POLL,
    now,
  );

  let alerts = 0;
  for (const a of picked) {
    const { data: inserted, error } = await sb
      .from("sniper_alerts")
      .upsert(
        {
          profile_id: profileId,
          source_tweet_id: a.source_tweet_id,
          author_handle: a.author_handle,
          tweet_text: a.tweet_text,
          tweet_url: a.tweet_url,
          score: a.score,
          score_parts: a.parts as unknown as Json,
          latency_ms: a.latencyMs,
        },
        { onConflict: "profile_id,source_tweet_id", ignoreDuplicates: true },
      )
      .select("id");
    if (error) {
      console.error("[sniper] alert insert failed:", error.message);
      continue;
    }
    if (!inserted || inserted.length === 0) continue; // raced — another poll already alerted

    const telegramConfigured = !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
    const result = await notify(
      profileId,
      {
        title: `🎯 @${a.author_handle} just posted`,
        body: a.tweet_text.slice(0, 140),
        url: "/engage",
        telegramText: alertTelegramText(a),
      },
      {
        sendTelegram: telegramConfigured ? (text) => sendTelegram(text) : undefined,
        loadPushSubs: async (pid) => {
          const { data } = await sb
            .from("push_subscriptions")
            .select("endpoint, p256dh, auth")
            .eq("profile_id", pid);
          return data ?? [];
        },
        sendPush: (sub, payload) => sendWebPush(sub, payload),
        prunePushSub: async (endpoint) => {
          await sb.from("push_subscriptions").delete().eq("endpoint", endpoint);
        },
      },
    );
    await sb
      .from("sniper_alerts")
      .update({ channels: result as unknown as Json })
      .eq("id", inserted[0].id);
    await logActivity(sb, profileId, "sniper_alert_sent", {
      refId: a.source_tweet_id,
      meta: { score: a.score, latency_ms: a.latencyMs, channels: result },
    });
    alerts++;
  }
  return { pulled: raw.length, alerts };
}

/** Cron entry: poll every profile that has an active watch list. */
export async function runSniperPollAll(): Promise<{ profiles: number; pulled: number; alerts: number }> {
  const sb = supabaseService();
  const { data } = await sb.from("watch_targets").select("profile_id").eq("active", true);
  const profileIds = [...new Set((data ?? []).map((r) => r.profile_id))];
  let pulled = 0;
  let alerts = 0;
  for (const id of profileIds) {
    try {
      const r = await runSniperPoll(id);
      pulled += r.pulled;
      alerts += r.alerts;
    } catch (err) {
      console.error(`[sniper] poll failed for profile ${id}:`, String(err).slice(0, 200));
    }
  }
  return { profiles: profileIds.length, pulled, alerts };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/server/sniper.test.ts`
Expected: PASS (3 tests — `pickAlerts` is the pure core; `runSniperPoll`'s I/O choreography is covered by the live-fire in Task 12, same posture as `scanTargetsForProfile`).

- [ ] **Step 5: Full suite**

Run: `npm test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/server/sniper.ts src/server/sniper.test.ts
git commit -m "feat(sniper): poll pipeline — lean pull, targetScore, idempotent alerts, notify fan-out, latency log"
```

---

### Task 8: Cron route — `/api/cron/sniper`

**Files:**
- Create: `src/app/api/cron/sniper/route.ts`

No unit test (house pattern: cron routes are thin wrappers over tested server fns; `cron-auth` already has its own tests).

- [ ] **Step 1: Implement the route** (mirror `follower-snapshot/route.ts` exactly)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { cronAuthError } from "@/lib/cron-auth";
import { runSniperPollAll } from "@/server/sniper";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const authError = cronAuthError(req);
  if (authError) return authError;
  try {
    const result = await runSniperPollAll();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("sniper poll failed:", err);
    return NextResponse.json({ ok: false, error: String(err).slice(0, 200) }, { status: 500 });
  }
}
```

- [ ] **Step 2: Build to verify the route registers**

Run: `npm run build`
Expected: green; `/api/cron/sniper` listed in the route table output.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/sniper/route.ts
git commit -m "feat(sniper): cron route — CRON_SECRET-gated poll-all"
```

---

### Task 9: GH-Actions workflow — `.github/workflows/sniper-poll.yml`

**Files:**
- Create: `.github/workflows/sniper-poll.yml`

- [ ] **Step 1: Write the workflow** (mirror `signal-crons.yml` curl pattern)

```yaml
name: sniper-poll

on:
  schedule:
    - cron: "*/15 6-22 * * *"   # every 15 min, waking hours UTC (Lisbon=UTC+1) — owner-locked lean cadence
  workflow_dispatch: {}

jobs:
  poll:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: sniper
        run: |
          code=$(curl -s -o /tmp/out -w "%{http_code}" -m 300 -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" "${{ vars.APP_BASE_URL }}/api/cron/sniper")
          cat /tmp/out; echo; [ "$code" = "200" ]
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/sniper-poll.yml
git commit -m "feat(sniper): 15-min GH-Actions poll workflow (waking hours UTC)"
```

> Note: repo is public — Actions minutes are free; the cadence cost constraint is Apify, already handled by `MAX_PER_HANDLE = 3`.

---

### Task 10: Sniper pins on `/engage` + act/dismiss actions

**Files:**
- Modify: `src/server/sniper.ts` (append read/act functions)
- Create: `src/components/sniper-pins.tsx`
- Modify: `src/app/(app)/engage/page.tsx`
- Test: `src/server/sniper-pins.test.ts`

- [ ] **Step 1: Write the failing test for the presenter logic**

`src/server/sniper-pins.test.ts` — test the pure row→pin mapping:

```typescript
import { describe, it, expect } from "vitest";
import { toSniperPin } from "@/server/sniper";

describe("toSniperPin", () => {
  it("maps an alert row to a display pin with 0-100 score and freshness", () => {
    const now = new Date("2026-06-12T10:00:00Z").getTime();
    const pin = toSniperPin(
      {
        id: "a1",
        author_handle: "big",
        tweet_text: "hot take",
        tweet_url: "https://x.com/big/status/1",
        score: 0.72,
        latency_ms: 540_000,
        created_at: "2026-06-12T09:45:00Z",
      },
      now,
    );
    expect(pin).toEqual({
      alertId: "a1",
      authorHandle: "big",
      text: "hot take",
      url: "https://x.com/big/status/1",
      score: 72,
      freshness: "15 min ago",
      latencyMin: 9,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/sniper-pins.test.ts`
Expected: FAIL — `toSniperPin` not exported.

- [ ] **Step 3: Append to `src/server/sniper.ts`**

Add imports at top of file:

```typescript
import { freshnessLabel } from "@/lib/engagement/present";
import { revalidatePath } from "next/cache";
```

Append:

```typescript
const PIN_WINDOW_H = 3; // pins expire with the first-to-comment window

export interface SniperPin {
  alertId: string;
  authorHandle: string;
  text: string;
  url: string;
  score: number;     // 0-100
  freshness: string;
  latencyMin: number; // detection latency — the paid-tier baseline, surfaced honestly
}

export interface SniperAlertRowLite {
  id: string;
  author_handle: string;
  tweet_text: string;
  tweet_url: string;
  score: number;
  latency_ms: number;
  created_at: string;
}

export function toSniperPin(row: SniperAlertRowLite, nowMs: number): SniperPin {
  return {
    alertId: row.id,
    authorHandle: row.author_handle,
    text: row.tweet_text,
    url: row.tweet_url,
    score: Math.round(row.score * 100),
    freshness: freshnessLabel(row.created_at, nowMs),
    latencyMin: Math.round(row.latency_ms / 60_000),
  };
}

/** Active (un-acted, in-window) sniper alerts, hottest first — pinned on /engage. */
export async function getSniperPins(profileId: string): Promise<SniperPin[]> {
  const sb = supabaseService();
  const cutoff = new Date(Date.now() - PIN_WINDOW_H * 3600_000).toISOString();
  const { data } = await sb
    .from("sniper_alerts")
    .select("id, author_handle, tweet_text, tweet_url, score, latency_ms, created_at")
    .eq("profile_id", profileId)
    .eq("status", "sent")
    .gte("created_at", cutoff)
    .order("score", { ascending: false })
    .limit(5);
  const now = Date.now();
  return (data ?? []).map((row) => toSniperPin(row, now));
}

export async function markSniperAlert(
  profileId: string,
  alertId: string,
  action: "acted" | "dismissed",
): Promise<void> {
  const sb = supabaseService();
  const { error } = await sb
    .from("sniper_alerts")
    .update({ status: action })
    .eq("id", alertId)
    .eq("profile_id", profileId);
  if (error) throw new Error(`marking sniper alert failed: ${error.message}`);
  if (action === "acted") {
    await logActivity(sb, profileId, "sniper_alert_acted", { refId: alertId });
  }
  revalidatePath("/engage");
}
```

> `src/server/sniper.ts` has no `"use server"` directive (it exports non-async helpers). Server actions called from the client component go through a thin wrapper — see Step 5.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/sniper-pins.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the actions wrapper + pins component**

Create `src/server/sniper-actions.ts`:

```typescript
"use server";
import { markSniperAlert } from "@/server/sniper";

export async function actOnSniperAlert(
  profileId: string,
  alertId: string,
  action: "acted" | "dismissed",
): Promise<void> {
  await markSniperAlert(profileId, alertId, action);
}
```

Create `src/components/sniper-pins.tsx`:

```tsx
"use client";
import { useState, useTransition } from "react";
import { actOnSniperAlert } from "@/server/sniper-actions";
import type { SniperPin } from "@/server/sniper";

export function SniperPins({ profileId, pins: initial }: { profileId: string; pins: SniperPin[] }) {
  const [pins, setPins] = useState(initial);
  const [pending, startTransition] = useTransition();

  if (pins.length === 0) return null;

  function act(alertId: string, action: "acted" | "dismissed") {
    setPins((p) => p.filter((x) => x.alertId !== alertId)); // optimistic — the window is minutes
    startTransition(() => actOnSniperAlert(profileId, alertId, action).catch(() => {}));
  }

  return (
    <div className="mb-5 space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-500">
        🎯 Sniper — be first
      </div>
      {pins.map((p) => (
        <div
          key={p.alertId}
          className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3"
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[13px] font-medium">@{p.authorHandle}</span>
            <span className="text-[11px] text-muted-foreground">
              {p.freshness} · detected in {p.latencyMin}m · score {p.score}
            </span>
          </div>
          <p className="text-[13px] text-muted-foreground line-clamp-3 mb-2">{p.text}</p>
          <div className="flex items-center gap-2">
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-500 font-medium"
            >
              Open & reply ↗
            </a>
            <button
              disabled={pending}
              onClick={() => act(p.alertId, "acted")}
              className="text-[12px] px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground"
            >
              ✅ Done
            </button>
            <button
              disabled={pending}
              onClick={() => act(p.alertId, "dismissed")}
              className="text-[12px] px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground"
            >
              ⏭️ Skip
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Wire into the Engage page**

In `src/app/(app)/engage/page.tsx`:

```tsx
import { getSniperPins } from "@/server/sniper";
import { SniperPins } from "@/components/sniper-pins";
```

In the component body, alongside `initialItems`:

```tsx
  const sniperPins = profiles[0] ? await getSniperPins(profiles[0].id).catch(() => []) : [];
```

Inside `activeTab === "engage"`, render pins ABOVE the queue (after `PushOptIn`, before the `<p>`):

```tsx
          {profiles[0] && <SniperPins profileId={profiles[0].id} pins={sniperPins} />}
```

- [ ] **Step 7: Full suite + build**

Run: `npm test && npm run build`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add src/server/sniper.ts src/server/sniper-actions.ts src/server/sniper-pins.test.ts src/components/sniper-pins.tsx "src/app/(app)/engage/page.tsx"
git commit -m "feat(sniper): /engage pins — act/dismiss with latency surfaced"
```

---

### Task 11: Watch-list management card on `/board`

**Files:**
- Create: `src/lib/sniper/watch.ts` (pure helpers — `"use server"` files may only export async functions, so the sync helper + const live in lib)
- Create: `src/server/watch-targets.ts`
- Create: `src/components/watch-targets-card.tsx`
- Modify: `src/app/(app)/board/page.tsx`
- Test: `src/lib/sniper/watch.test.ts`

- [ ] **Step 1: Write the failing test for handle normalization + cap**

`src/lib/sniper/watch.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { normalizeWatchHandle, MAX_ACTIVE_WATCH_TARGETS } from "@/lib/sniper/watch";

describe("normalizeWatchHandle", () => {
  it("strips @, URL prefixes and lowercases", () => {
    expect(normalizeWatchHandle("@LevelsIo")).toBe("levelsio");
    expect(normalizeWatchHandle("https://x.com/levelsio")).toBe("levelsio");
    expect(normalizeWatchHandle("  levelsio  ")).toBe("levelsio");
  });
  it("rejects empty and invalid handles", () => {
    expect(normalizeWatchHandle("")).toBeNull();
    expect(normalizeWatchHandle("not a handle!")).toBeNull();
  });
  it("caps the active watch list at 10 (paid-tier lever)", () => {
    expect(MAX_ACTIVE_WATCH_TARGETS).toBe(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/sniper/watch.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/sniper/watch.ts` then `src/server/watch-targets.ts`**

`src/lib/sniper/watch.ts`:

```typescript
export const MAX_ACTIVE_WATCH_TARGETS = 10; // spec: 5-10 priority handles; list size = paid-tier lever

/** "@LevelsIo" / "https://x.com/levelsio" / " levelsio " → "levelsio"; null if not a handle. */
export function normalizeWatchHandle(input: string): string | null {
  const h = input
    .trim()
    .replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
  return /^[a-z0-9_]{1,15}$/.test(h) ? h : null;
}
```

`src/server/watch-targets.ts`:

```typescript
"use server";
import { supabaseService } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { normalizeWatchHandle, MAX_ACTIVE_WATCH_TARGETS } from "@/lib/sniper/watch";

export interface WatchTarget {
  id: string;
  handle: string;
  priority: number;
}

export async function listWatchTargets(profileId: string): Promise<WatchTarget[]> {
  const sb = supabaseService();
  const { data } = await sb
    .from("watch_targets")
    .select("id, handle, priority")
    .eq("profile_id", profileId)
    .eq("active", true)
    .order("priority", { ascending: false });
  return data ?? [];
}

export async function addWatchTarget(
  profileId: string,
  rawHandle: string,
  priority = 1,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const handle = normalizeWatchHandle(rawHandle);
  if (!handle) return { ok: false, error: "That doesn't look like an X handle." };
  const sb = supabaseService();
  const { count } = await sb
    .from("watch_targets")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .eq("active", true);
  if ((count ?? 0) >= MAX_ACTIVE_WATCH_TARGETS) {
    return { ok: false, error: `Watch list is capped at ${MAX_ACTIVE_WATCH_TARGETS} handles.` };
  }
  const { error } = await sb
    .from("watch_targets")
    .upsert(
      { profile_id: profileId, handle, priority, active: true },
      { onConflict: "profile_id,handle" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/board");
  return { ok: true };
}

export async function removeWatchTarget(profileId: string, id: string): Promise<void> {
  const sb = supabaseService();
  await sb.from("watch_targets").update({ active: false }).eq("id", id).eq("profile_id", profileId);
  revalidatePath("/board");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/sniper/watch.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Create `src/components/watch-targets-card.tsx`**

```tsx
"use client";
import { useState, useTransition } from "react";
import { addWatchTarget, removeWatchTarget, type WatchTarget } from "@/server/watch-targets";

export function WatchTargetsCard({
  profileId,
  targets,
}: {
  profileId: string;
  targets: WatchTarget[];
}) {
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    setError(null);
    startTransition(async () => {
      const r = await addWatchTarget(profileId, handle);
      if (!r.ok) setError(r.error);
      else setHandle("");
    });
  }

  return (
    <div className="rounded-lg border border-border p-4 mb-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[13px] font-semibold">🎯 Sniper watch list</h3>
        <span className="text-[11px] text-muted-foreground">{targets.length}/10 · polled every 15 min</span>
      </div>
      <p className="text-[12px] text-muted-foreground mb-3">
        Priority handles watched for first-to-comment alerts (Telegram + push).
      </p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {targets.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1 text-[12px] px-2 py-0.5 rounded-full border border-border"
          >
            @{t.handle}
            <button
              disabled={pending}
              onClick={() => startTransition(() => removeWatchTarget(profileId, t.id))}
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Remove @${t.handle}`}
            >
              ×
            </button>
          </span>
        ))}
        {targets.length === 0 && (
          <span className="text-[12px] text-muted-foreground">No handles yet — add 5-10 below.</span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handle.trim() && add()}
          placeholder="@handle or profile URL"
          className="flex-1 text-[13px] bg-background border border-border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          disabled={pending || !handle.trim()}
          onClick={add}
          className="text-[13px] px-3 py-1.5 rounded-md border border-border font-medium disabled:opacity-50"
        >
          Watch
        </button>
      </div>
      {error && <p className="text-[12px] text-rose-400 mt-2">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 6: Wire into `/board`**

`src/app/(app)/board/page.tsx`:

```tsx
import { listProfiles } from "@/server/profiles";
import { listWatchTargets } from "@/server/watch-targets";
import { TargetBoardPanel } from "@/components/target-board";
import { WatchTargetsCard } from "@/components/watch-targets-card";
import { PageShell } from "@/components/shell/page-shell";

export default async function BoardPage() {
  const profiles = (await listProfiles()) ?? [];
  const watchTargets = profiles[0] ? await listWatchTargets(profiles[0].id).catch(() => []) : [];
  return (
    <PageShell
      title="Targeting board"
      subtitle="X accounts ranked by growth impact — who to follow and engage with today."
    >
      {profiles[0] && <WatchTargetsCard profileId={profiles[0].id} targets={watchTargets} />}
      <TargetBoardPanel profiles={profiles} />
    </PageShell>
  );
}
```

- [ ] **Step 7: Full suite + build**

Run: `npm test && npm run build`
Expected: all green, suite ≥545 + the ~20 new tests from this plan.

- [ ] **Step 8: Commit**

```bash
git add src/lib/sniper/watch.ts src/lib/sniper/watch.test.ts src/server/watch-targets.ts src/components/watch-targets-card.tsx "src/app/(app)/board/page.tsx"
git commit -m "feat(sniper): watch-list management card on /board (capped at 10)"
```

---

### Task 12: Owner-gated live-fire dogfood (NOT autonomous — needs the owner)

**Files:** none (ops). Run with the owner present.

- [ ] **Step 1: Apply the migration to live Supabase**

Via Supabase MCP `apply_migration` against project `vzxpakxjnuaesfxihyvl` with the contents of `supabase/migrations/20260613_sniper.sql`.
Expected: three tables exist; `list_tables` confirms.

- [ ] **Step 2: Generate + set VAPID keys**

Run: `npx web-push generate-vapid-keys`
Set in **Vercel prod env**: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:cisco.vieira25@gmail.com`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (same as public). Mirror into local `.env.local`.
⚠️ **Windows gotcha (recorded in memory):** never pipe values into `gh secret set` / `vercel env add` — trailing `\r` corrupts them. Use `--body` / paste interactively.

- [ ] **Step 3: Confirm GH side**

`CRON_SECRET` secret + `APP_BASE_URL` variable already exist (signal-crons uses them) — nothing new needed for the workflow. Verify with: `gh secret list` / `gh variable list`.

- [ ] **Step 4: Push to main → auto prod deploy**

```bash
git push origin main
```

Watch the Vercel deploy go green.

- [ ] **Step 5: Seed the watch list**

On prod `/board`, add 5–10 priority handles from the in-niche big-account lane (owner picks; the vault FCisco95 board + seed_targets are the source — bias to AI×crypto bridge accounts in the 2–10× band, ~2.6k–13k followers).

- [ ] **Step 6: Subscribe the phone**

On the phone PWA, open `/engage` → tap **🔔 Enable sniper alerts on this device** → accept the permission prompt. Verify a row landed in `push_subscriptions`.

- [ ] **Step 7: Live-fire the poll**

Run: `gh workflow run sniper-poll` (workflow_dispatch), or wait for the next 15-min tick.
Expected: workflow green; response JSON shows `{ ok: true, profiles: 1, pulled: N, alerts: M }`. If a watched handle posted in the last 3h with a qualifying score: Telegram message AND phone push notification arrive; `sniper_alerts` row has `latency_ms`, `score_parts`, `channels`; `activity_events` has `sniper_alert_sent`. If nothing fresh: temporarily lower `SNIPER_MIN_SCORE` to `0.3` on Vercel, re-dispatch, then restore.

- [ ] **Step 8: Act on the pin**

Open `/engage` on the phone → sniper pin visible on top → tap **Open & reply ↗** → reply on X → back → **✅ Done**.
Expected: pin disappears; `sniper_alerts.status='acted'`; `activity_events` has `sniper_alert_acted`.

- [ ] **Step 9: Watch the first scheduled cycle's Apify burn**

After ~1 day, check Apify console usage delta. Expected: roughly ≤$0.50/day. If materially higher, widen the cron to `*/20` or `*/30` (one-line workflow change) — cadence is deliberately the only tuning knob.

---

## Self-review notes (spec coverage)

- `watch_targets` + 5–10 handles → Tasks 1, 11 ✓
- GH-Actions poll (owner-locked 15-min lean, not 5-min) → Task 9 ✓
- vault `targetScore()` productized, band 2–10× → Tasks 2, 3 ✓ (band standardized repo-wide per spec note)
- unified Telegram + web-push `notify()` → Tasks 4, 5, 6 ✓
- alert latency logged (paid-tier baseline) → `latency_ms` in Task 7, surfaced in Task 10 pin ("detected in Xm") ✓
- sniper pins on top of `/engage` (spec UI map) → Task 10 ✓
- config hooks for tiers (spec decision 5): `MAX_WATCH_HANDLES`, `ALERT_CAP_PER_POLL`, `SNIPER_MIN_SCORE`, poll cadence — all single-point constants/env, ready for P7 `TIER_LIMITS` ✓
- zero-new-spend: only new spend is marginal Apify usage inside existing Starter sub ✓

**Known deferred (deliberate):**
- Telegram callback buttons on sniper alerts (acting lives on the `/engage` pin; Telegram-side Done belongs to the P0-residual nudge/Telegram workstream that owns `telegram-poll.ts`).
- Per-profile Telegram chat IDs (P7 — spec row says so explicitly; `notify()`'s injected `sendTelegram` makes the swap trivial).
- RLS on the three new tables (P7 hardening, same posture as the 14 existing warehouse tables).
- `runSniperPoll` I/O choreography has no unit test — same accepted posture as `scanTargetsForProfile`; the pure cores (`targetScore`, `pickAlerts`, `toSniperPin`, `normalizeWatchHandle`) are fully tested and Task 12 live-fires the pipe.
