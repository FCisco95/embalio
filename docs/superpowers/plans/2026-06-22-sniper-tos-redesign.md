# Sniper ToS Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Embalio opportunity Sniper X-ToS-compliant — kill the AdsPower auto-post vector on the reply path, draft replies the human sends manually via X Web Intents, and enforce the Engagement Playbook hard caps.

**Architecture:** Keep the existing read→score→draft→notify pipeline (Apify source, `targetScore`, `notify` fan-out, `sniper_alerts` ledger). Sever app-posting for `kind='reply'` drafts. Generate a reply draft at alert time, ship it to the human through a one-tap X reply-intent URL (PWA swipe card + Telegram buttons), and log the manual send. A pure caps module blocks any send that would breach `<50/day · <20/hr · ≤3/account/day · no links · no near-dups`.

**Tech Stack:** Next.js App Router (Server Components + `"use server"` actions), Supabase (`supabaseService()` service-role on the cron path, `supabaseServer()` RLS on actions), Vitest, TypeScript, Tailwind.

**Spec:** `cisco-brain/10 - PROJECTS/Embalio/specs/2026-06-22-sniper-tos-redesign-design.md`

**Compliance invariant (do not violate):** No code in this plan may post to X via API or browser automation for a reply. Every "send" opens X's first-party composer; the human taps Post. Verified: a human pressing send does NOT exempt an API/automation write (X Automation Rules, Apr 2026).

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260622_sniper_manual_send.sql` | Create | Add `draft_reply`, `sent_reply_text`, `sent_at` to `sniper_alerts` |
| `src/lib/supabase/types.ts` | Modify | Regenerate (or hand-add) the 3 new nullable columns |
| `src/server/posting.ts` | Modify | `postDraft` refuses `kind='reply'` (manual-send only) |
| `src/lib/send/intent.ts` | Create | Pure: `buildReplyIntentUrl`, `buildStatusUrl` |
| `src/lib/send/intent.test.ts` | Create | Tests for the two URL builders |
| `src/lib/engagement/caps.ts` | Create | Pure: `checkCaps`, `hasLink`, `similarity` |
| `src/lib/engagement/caps.test.ts` | Create | Tests for the cap rules |
| `src/server/caps.ts` | Create | `loadRecentSends` — gathers the 24h acted-send window |
| `src/lib/telegram.ts` | Modify | `TelegramButton` gains `url` / `copyText` variants |
| `src/lib/telegram.test.ts` | Create | `reply_markup` serialization for url/copy/callback buttons |
| `src/server/sniper.ts` | Modify | Draft at alert time; intent URL into notify; `getSniperPins` carries draft + caps; `markSniperReplySent` |
| `src/server/sniper-actions.ts` | Modify | `confirmSentReply` action |
| `src/components/sniper-pins.tsx` | Modify | Swipe/Send card: edit → open intent → log; caps-disabled state |
| `supabase/seeds/2026-06-22-inband-handles.sql` | Create | Seed 4–6 in-band handles; deactivate oversized seeds |

---

## Task 1: Migration — manual-send columns on `sniper_alerts`

**Files:**
- Create: `supabase/migrations/20260622_sniper_manual_send.sql`
- Modify: `src/lib/supabase/types.ts`

- [ ] **Step 1: Write the migration**

```sql
-- Manual-send (ToS redesign): the drafted reply, plus what/when the human actually sent.
-- draft_reply  = LLM draft generated at alert time, fed into the X reply-intent URL.
-- sent_reply_text = the exact text the human confirmed sending (feeds the near-dup cap).
-- sent_at       = when the human confirmed the manual send (feeds the daily/hourly caps).
alter table public.sniper_alerts add column if not exists draft_reply text;
alter table public.sniper_alerts add column if not exists sent_reply_text text;
alter table public.sniper_alerts add column if not exists sent_at timestamptz;

-- Caps query reads acted sends in a rolling 24h window, per profile.
create index if not exists sniper_alerts_sent_idx
  on public.sniper_alerts (profile_id, sent_at desc)
  where status = 'acted';
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push` (or the repo's migrate command — check `package.json` scripts; e.g. `npm run db:push`)
Expected: migration applies, no error.

- [ ] **Step 3: Regenerate Supabase types**

Run the repo's type-gen (check `package.json`; typically `npm run gen:types` or `npx supabase gen types typescript --local > src/lib/supabase/types.ts`).
If no script exists, hand-add to the `sniper_alerts` Row/Insert/Update types in `src/lib/supabase/types.ts`:
```ts
// Row:
draft_reply: string | null
sent_reply_text: string | null
sent_at: string | null
// Insert & Update: same three keys, all `?: string | null`
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck` (or `npx tsc --noEmit`)
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260622_sniper_manual_send.sql src/lib/supabase/types.ts
git commit -m "feat(sniper): add manual-send columns to sniper_alerts"
```

---

## Task 2: Sever AdsPower posting for replies (safety-critical)

The reply flow can currently reach `postTweetViaAdsPower` via `candidate → draft(kind='reply') → approveDraft → postDraft`. Cut it. Studio originals (`kind != 'reply'`) stay (out of gate scope — separate follow-up).

**Files:**
- Modify: `src/server/posting.ts:51` (`postDraft`)
- Test: `src/server/posting.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/server/posting.test.ts`:
```ts
it("refuses to post a reply draft (manual-send only, ToS)", async () => {
  // A reply-kind draft must never reach AdsPower.
  mockSupabaseDraft({ id: "d1", status: "approved", kind: "reply", body: "hi", profile_id: "p1" });
  await expect(postDraft("d1")).rejects.toThrow(/manual-send only/i);
  expect(mockPostTweet).not.toHaveBeenCalled();
});
```
(Use the file's existing draft-mocking helper; match how other tests stub `sb.from("drafts").select(...).single()`.)

- [ ] **Step 2: Run it — verify it fails**

Run: `npx vitest run src/server/posting.test.ts -t "manual-send only"`
Expected: FAIL (currently `postDraft` proceeds to AdsPower).

- [ ] **Step 3: Add the guard in `postDraft`**

In `src/server/posting.ts`, immediately after the draft is loaded and the `status !== "approved"` check (around line 64), add:
```ts
  // ToS: replies are sent by the human in X's own UI. Embalio never posts a reply
  // via automation. Studio originals (kind != 'reply') are unaffected (follow-up).
  if (draft.kind === "reply") {
    throw new Error("reply drafts are manual-send only — open the X composer and post by hand");
  }
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `npx vitest run src/server/posting.test.ts -t "manual-send only"`
Expected: PASS. Also run the whole file: `npx vitest run src/server/posting.test.ts` — Expected: PASS (existing original-post tests untouched).

- [ ] **Step 5: Commit**

```bash
git add src/server/posting.ts src/server/posting.test.ts
git commit -m "feat(sniper): refuse AdsPower posting for reply drafts (ToS manual-send)"
```

---

## Task 3: `intent.ts` — manual-send URL builders (pure)

**Files:**
- Create: `src/lib/send/intent.ts`
- Test: `src/lib/send/intent.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/send/intent.test.ts
import { describe, it, expect } from "vitest";
import { buildReplyIntentUrl, buildStatusUrl } from "@/lib/send/intent";

describe("buildReplyIntentUrl", () => {
  it("threads under the target tweet and prefixes the @author", () => {
    const url = buildReplyIntentUrl("123", "alice", "great point about latency");
    expect(url).toBe(
      "https://x.com/intent/post?in_reply_to=123&text=%40alice%20great%20point%20about%20latency",
    );
  });
  it("strips a leading @ from the handle so we never double it", () => {
    expect(buildReplyIntentUrl("1", "@bob", "hi")).toContain("text=%40bob%20hi");
  });
  it("url-encodes newlines, hashes and ampersands in the draft", () => {
    const url = buildReplyIntentUrl("1", "a", "x #y & z\nq");
    expect(url).toContain("%40a%20x%20%23y%20%26%20z%0Aq");
  });
});

describe("buildStatusUrl", () => {
  it("links to the tweet so the native app intercepts it (fallback path)", () => {
    expect(buildStatusUrl("carol", "999")).toBe("https://x.com/carol/status/999");
  });
  it("strips a leading @ from the handle", () => {
    expect(buildStatusUrl("@dan", "5")).toBe("https://x.com/dan/status/5");
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `npx vitest run src/lib/send/intent.test.ts`
Expected: FAIL ("Cannot find module '@/lib/send/intent'").

- [ ] **Step 3: Implement**

```ts
// src/lib/send/intent.ts
// Manual-send URL builders. NO API write: these open X's first-party composer;
// the human taps Post. Verified-live 2026: intent/post + in_reply_to threads as a
// reply; x.com/<user>/status/<id> is intercepted by the native app.
// `in_reply_to` is absent from X's formal param reference (deprecation risk) — the
// caller feature-flags between this and the status-URL fallback.

const stripAt = (h: string): string => h.replace(/^@+/, "");

/** One-tap reply: opens the native composer pre-threaded under the target tweet. */
export function buildReplyIntentUrl(tweetId: string, authorHandle: string, draft: string): string {
  const text = encodeURIComponent(`@${stripAt(authorHandle)} ${draft}`);
  return `https://x.com/intent/post?in_reply_to=${encodeURIComponent(tweetId)}&text=${text}`;
}

/** Fallback: open the exact tweet (native app intercepts); human taps Reply + pastes. */
export function buildStatusUrl(authorHandle: string, tweetId: string): string {
  return `https://x.com/${stripAt(authorHandle)}/status/${encodeURIComponent(tweetId)}`;
}
```
Note: `encodeURIComponent` encodes space as `%20` (not `+`) and encodes `#`,`&`,`\n` as the tests expect.

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run src/lib/send/intent.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/send/intent.ts src/lib/send/intent.test.ts
git commit -m "feat(sniper): X reply-intent + status-url manual-send builders"
```

---

## Task 4: `caps.ts` — Engagement Playbook hard caps (pure)

Rolling windows (stricter + deterministic): daily = last 24h, hourly = last 1h, per-account = last 24h.

**Files:**
- Create: `src/lib/engagement/caps.ts`
- Test: `src/lib/engagement/caps.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/engagement/caps.test.ts
import { describe, it, expect } from "vitest";
import { checkCaps, hasLink, similarity, type SentAction } from "@/lib/engagement/caps";

const HOUR = 3_600_000;
const mk = (over: Partial<SentAction> = {}): SentAction =>
  ({ authorHandle: "x", sentAt: 0, replyText: "y", ...over });

describe("hasLink", () => {
  it("flags http/https and bare-domain links", () => {
    expect(hasLink("see https://a.com")).toBe(true);
    expect(hasLink("visit a.com/b")).toBe(true);
    expect(hasLink("no links here")).toBe(false);
  });
});

describe("similarity", () => {
  it("is 1 for identical and ~0 for disjoint word sets", () => {
    expect(similarity("alpha beta gamma", "alpha beta gamma")).toBe(1);
    expect(similarity("alpha beta", "delta epsilon")).toBe(0);
  });
});

describe("checkCaps", () => {
  const now = 100 * HOUR;
  it("passes a clean draft with no recent sends", () => {
    expect(checkCaps({ now, draft: "a specific point", targetHandle: "alice", recent: [] }))
      .toEqual({ ok: true, blocks: [] });
  });
  it("blocks links", () => {
    const v = checkCaps({ now, draft: "check my site.com", targetHandle: "a", recent: [] });
    expect(v.ok).toBe(false);
    expect(v.blocks).toContain("link");
  });
  it("blocks the 3rd reply to the same account in 24h", () => {
    const recent = [mk({ authorHandle: "alice", sentAt: now - HOUR }), mk({ authorHandle: "alice", sentAt: now - 2 * HOUR })];
    expect(checkCaps({ now, draft: "new", targetHandle: "alice", recent }).blocks).toContain("per_account");
  });
  it("does NOT count same-account sends older than 24h", () => {
    const recent = [mk({ authorHandle: "alice", sentAt: now - 25 * HOUR }), mk({ authorHandle: "alice", sentAt: now - 26 * HOUR })];
    expect(checkCaps({ now, draft: "new", targetHandle: "alice", recent }).ok).toBe(true);
  });
  it("blocks at 20 sends in the last hour", () => {
    const recent = Array.from({ length: 20 }, (_, i) => mk({ authorHandle: `h${i}`, sentAt: now - 1000 * i }));
    expect(checkCaps({ now, draft: "new", targetHandle: "z", recent }).blocks).toContain("hourly");
  });
  it("blocks at 50 sends in the last 24h", () => {
    const recent = Array.from({ length: 50 }, (_, i) => mk({ authorHandle: `h${i}`, sentAt: now - HOUR - 1000 * i }));
    expect(checkCaps({ now, draft: "new", targetHandle: "z", recent }).blocks).toContain("daily");
  });
  it("blocks a near-identical reply", () => {
    const recent = [mk({ replyText: "latency is the silent killer in agents", sentAt: now - HOUR })];
    const v = checkCaps({ now, draft: "latency is the silent killer in agents today", targetHandle: "z", recent });
    expect(v.blocks).toContain("near_duplicate");
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `npx vitest run src/lib/engagement/caps.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// src/lib/engagement/caps.ts
// Engagement Playbook hard caps (enforced, not coached): <50/day, <20/hr,
// <=3 to the same account/day, no links in replies, no near-identical replies.
// Pure: the server layer supplies `recent` (acted sends in the last 24h).

const DAY = 86_400_000;
const HOUR = 3_600_000;
export const CAPS = { perDay: 50, perHour: 20, perAccountPerDay: 3, nearDupThreshold: 0.8 };

export type CapBlock = "daily" | "hourly" | "per_account" | "link" | "near_duplicate";

export interface SentAction {
  authorHandle: string;
  sentAt: number; // epoch ms
  replyText: string;
}
export interface CapInput {
  now: number;
  draft: string;
  targetHandle: string;
  recent: SentAction[]; // acted sends, last 24h, same profile
}
export interface CapVerdict { ok: boolean; blocks: CapBlock[]; }

const LINK_RE = /(https?:\/\/|\bwww\.|\b[a-z0-9-]+\.(com|io|net|org|co|app|dev|xyz|ai|gg)\b)/i;
export function hasLink(text: string): boolean {
  return LINK_RE.test(text);
}

const words = (t: string): Set<string> =>
  new Set(t.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean));

/** Jaccard overlap of word sets, 0..1. */
export function similarity(a: string, b: string): number {
  const A = words(a), B = words(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

const norm = (h: string): string => h.replace(/^@+/, "").toLowerCase();

export function checkCaps(i: CapInput): CapVerdict {
  const blocks: CapBlock[] = [];
  const dayCut = i.now - DAY;
  const hourCut = i.now - HOUR;
  const inDay = i.recent.filter((r) => r.sentAt > dayCut);

  if (inDay.length >= CAPS.perDay) blocks.push("daily");
  if (inDay.filter((r) => r.sentAt > hourCut).length >= CAPS.perHour) blocks.push("hourly");
  if (inDay.filter((r) => norm(r.authorHandle) === norm(i.targetHandle)).length >= CAPS.perAccountPerDay)
    blocks.push("per_account");
  if (hasLink(i.draft)) blocks.push("link");
  if (inDay.some((r) => similarity(i.draft, r.replyText) >= CAPS.nearDupThreshold))
    blocks.push("near_duplicate");

  return { ok: blocks.length === 0, blocks };
}
```

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run src/lib/engagement/caps.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/engagement/caps.ts src/lib/engagement/caps.test.ts
git commit -m "feat(sniper): pure engagement-cap rules (day/hour/account/link/near-dup)"
```

---

## Task 5: `loadRecentSends` — the caps data window (server)

**Files:**
- Create: `src/server/caps.ts`

- [ ] **Step 1: Implement** (thin DB adapter — no new pure logic, so no separate unit test; exercised via Task 8)

```ts
// src/server/caps.ts
import { supabaseService } from "@/lib/supabase/server";
import type { SentAction } from "@/lib/engagement/caps";

/** Acted sniper sends in the last 24h for a profile — the window the caps read. */
export async function loadRecentSends(profileId: string, nowMs = Date.now()): Promise<SentAction[]> {
  const sb = supabaseService();
  const cutoff = new Date(nowMs - 86_400_000).toISOString();
  const { data } = await sb
    .from("sniper_alerts")
    .select("author_handle, sent_at, sent_reply_text")
    .eq("profile_id", profileId)
    .eq("status", "acted")
    .gte("sent_at", cutoff);
  return (data ?? [])
    .filter((r) => r.sent_at)
    .map((r) => ({
      authorHandle: r.author_handle,
      sentAt: new Date(r.sent_at as string).getTime(),
      replyText: r.sent_reply_text ?? "",
    }));
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/server/caps.ts
git commit -m "feat(sniper): loadRecentSends window for cap enforcement"
```

---

## Task 6: Telegram `url` + `copyText` buttons

`TelegramButton` today only models callback buttons (`text`+`data`→`callback_data`). Add URL buttons (open the intent) and copy buttons (Bot API 7.11 `copy_text`, ≤256 chars).

**Files:**
- Modify: `src/lib/telegram.ts:5-10` (`TelegramButton`), `:46-52` (serialization)
- Test: `src/lib/telegram.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/telegram.test.ts
import { describe, it, expect, vi } from "vitest";
import { sendTelegram } from "@/lib/telegram";

function captureBody() {
  const calls: any[] = [];
  const fetchImpl = vi.fn(async (_url: string, init: any) => {
    calls.push(JSON.parse(init.body));
    return { ok: true, text: async () => "" } as Response;
  });
  return { fetchImpl, calls };
}

describe("sendTelegram inline keyboard", () => {
  it("serializes url, copy and callback buttons into reply_markup", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "t"; process.env.TELEGRAM_CHAT_ID = "c";
    const { fetchImpl, calls } = captureBody();
    await sendTelegram("hello", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      buttons: [
        [{ text: "Open & reply", url: "https://x.com/intent/post?in_reply_to=1&text=hi" }],
        [{ text: "📋 Copy", copyText: "hi there" }],
        [{ text: "✅ Sent", data: "alert:sent:1" }],
      ],
    });
    expect(calls[0].reply_markup.inline_keyboard).toEqual([
      [{ text: "Open & reply", url: "https://x.com/intent/post?in_reply_to=1&text=hi" }],
      [{ text: "📋 Copy", copy_text: { text: "hi there" } }],
      [{ text: "✅ Sent", callback_data: "alert:sent:1" }],
    ]);
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `npx vitest run src/lib/telegram.test.ts`
Expected: FAIL (url/copyText not serialized; TS error on the new fields).

- [ ] **Step 3: Implement**

Replace the `TelegramButton` interface (`src/lib/telegram.ts:5-10`) with a discriminated shape:
```ts
export interface TelegramButton {
  /** Button label shown to the user. */
  text: string;
  /** Callback payload delivered back when tapped (≤64 bytes). Mutually exclusive with url/copyText. */
  data?: string;
  /** Open this URL on tap (e.g. the X reply-intent). */
  url?: string;
  /** One-tap copy to clipboard (Bot API 7.11; ≤256 chars). */
  copyText?: string;
}
```
Replace the serialization block (`src/lib/telegram.ts:46-52`) with:
```ts
  if (opts.buttons) {
    body.reply_markup = {
      inline_keyboard: opts.buttons.map((row) =>
        row.map((b) => {
          if (b.url) return { text: b.text, url: b.url };
          if (b.copyText !== undefined) return { text: b.text, copy_text: { text: b.copyText } };
          return { text: b.text, callback_data: b.data ?? "" };
        }),
      ),
    };
  }
```

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run src/lib/telegram.test.ts`
Expected: PASS. Then `npm run typecheck` — Expected: PASS (existing callback-button callers still valid; `data` is now optional but they pass it).

- [ ] **Step 5: Commit**

```bash
git add src/lib/telegram.ts src/lib/telegram.test.ts
git commit -m "feat(telegram): url + copy_text inline buttons for manual-send"
```

---

## Task 7: Draft at alert time + ship the intent to the human

Modify `runSniperPoll` so each new alert gets a `draft_reply` (best-effort) and the notification carries the one-tap reply intent. The web-push deep-links to `/engage`; Telegram gets Open-intent + Copy + Sent/Skip buttons.

**Files:**
- Modify: `src/server/sniper.ts` (imports; `alertTelegramText` → buttons; the insert + notify block `:157-200`)
- Modify: `src/server/notify-deps.ts` — pass `SendOpts` through `sendTelegram`

- [ ] **Step 1: Let notify deps forward Telegram options**

In `src/lib/notify.ts`, widen the dep + payload so buttons survive the fan-out:
```ts
// NotifyDeps.sendTelegram:
sendTelegram?: (text: string, opts?: { buttons?: import("@/lib/telegram").TelegramButton[][]; parseMode?: "HTML" | "MarkdownV2" }) => Promise<void>;
// NotifyPayload: add
telegramButtons?: import("@/lib/telegram").TelegramButton[][];
```
In the `telegramWork` block, pass them through:
```ts
await deps.sendTelegram(
  payload.telegramText ?? `${payload.title}\n${payload.body}`,
  { buttons: payload.telegramButtons },
);
```
In `src/server/notify-deps.ts`, the wired `sendTelegram` already calls `sendTelegram(text)` — change to `(text, opts) => sendTelegram(text, opts)`.

- [ ] **Step 2: Generate the draft + build buttons in `runSniperPoll`**

In `src/server/sniper.ts`, add imports:
```ts
import { draftReply } from "@/lib/drafting";
import { buildReplyIntentUrl, buildStatusUrl } from "@/lib/send/intent";
import type { TelegramButton } from "@/lib/telegram";
```
Replace `alertTelegramText` with a version that also returns buttons:
```ts
function alertButtons(a: PickedAlert, draft: string | null): TelegramButton[][] {
  const replyUrl =
    draft && process.env.REPLY_INTENT_ENABLED === "1"
      ? buildReplyIntentUrl(a.source_tweet_id, a.author_handle, draft)
      : buildStatusUrl(a.author_handle, a.source_tweet_id);
  const rows: TelegramButton[][] = [[{ text: "Open & reply ↗", url: replyUrl }]];
  if (draft && draft.length <= 256) rows.push([{ text: "📋 Copy draft", copyText: draft }]);
  rows.push([
    { text: "✅ Sent", data: `alert:sent:${a.source_tweet_id}` },
    { text: "⏭️ Skip", data: `alert:skip:${a.source_tweet_id}` },
  ]);
  return rows;
}
```
Inside the `for (const a of picked)` loop, BEFORE the insert, generate the draft (best-effort — never let drafting failure drop an alert):
```ts
    let draft: string | null = null;
    try {
      const d = await draftReply(profile, a.tweet_text);
      draft = d.body?.trim() || null;
    } catch (err) {
      console.error("[sniper] draft failed (alert still sent):", String(err).slice(0, 160));
    }
```
Add `draft_reply: draft` to the `.upsert({...})` object. Then change the `notify(...)` payload to:
```ts
      {
        title: `🎯 @${a.author_handle} just posted`,
        body: a.tweet_text.slice(0, 140),
        url: "/engage",
        telegramText: alertTelegramText(a, draft),
        telegramButtons: alertButtons(a, draft),
      },
```
Update `alertTelegramText` signature to `(a: PickedAlert, draft: string | null)` and append the draft under the tweet when present:
```ts
function alertTelegramText(a: PickedAlert, draft: string | null): string {
  const body = a.tweet_text.length > 220 ? `${a.tweet_text.slice(0, 220)}…` : a.tweet_text;
  const lines = [
    `🎯 Sniper: @${a.author_handle} — ${a.ageMinutes}m old · ${a.replies} replies · score ${Math.round(a.score * 100)}`,
    body,
  ];
  if (draft) lines.push(`\n✍️ Draft: ${draft}`);
  return lines.join("\n");
}
```

- [ ] **Step 3: Typecheck + run the sniper tests**

Run: `npm run typecheck`
Run: `npx vitest run src/server/sniper.test.ts`
Expected: PASS (the existing `pickAlerts` pure tests are unaffected; if a `runSniperPoll` integration test asserts the old notify payload, update it to expect the new `telegramButtons` field).

- [ ] **Step 4: Commit**

```bash
git add src/server/sniper.ts src/lib/notify.ts src/server/notify-deps.ts
git commit -m "feat(sniper): draft reply at alert time + one-tap reply-intent in notifications"
```

---

## Task 8: `getSniperPins` carries draft + caps; add send/skip server action

**Files:**
- Modify: `src/server/sniper.ts` (`SniperPin`, `SniperAlertRowLite`, `toSniperPin`, `getSniperPins`; add `markSniperReplySent`)
- Modify: `src/server/sniper-actions.ts` (add `confirmSentReply`)

- [ ] **Step 1: Extend the pin type + projection**

In `src/server/sniper.ts`, extend `SniperPin`:
```ts
export interface SniperPin {
  alertId: string;
  authorHandle: string;
  text: string;
  url: string;          // status URL (fallback / "open tweet")
  replyUrl: string;     // one-tap reply intent (or status URL when flag off / no draft)
  draft: string | null;
  blockedBy: import("@/lib/engagement/caps").CapBlock[];
  score: number;
  freshness: string;
  latencyMin: number;
}
```
Add `draft_reply` + `source_tweet_id` to `SniperAlertRowLite`:
```ts
export interface SniperAlertRowLite {
  id: string;
  source_tweet_id: string;
  author_handle: string;
  tweet_text: string;
  tweet_url: string;
  draft_reply: string | null;
  score: number;
  latency_ms: number;
  created_at: string;
}
```

- [ ] **Step 2: Rewrite `getSniperPins` to attach draft + caps (one recent-sends query, in-memory cap checks)**

```ts
import { checkCaps } from "@/lib/engagement/caps";
import { loadRecentSends } from "@/server/caps";
import { buildReplyIntentUrl, buildStatusUrl } from "@/lib/send/intent";

export async function getSniperPins(profileId: string): Promise<SniperPin[]> {
  const sb = supabaseService();
  const cutoff = new Date(Date.now() - PIN_WINDOW_H * 3600_000).toISOString();
  const { data } = await sb
    .from("sniper_alerts")
    .select("id, source_tweet_id, author_handle, tweet_text, tweet_url, draft_reply, score, latency_ms, created_at")
    .eq("profile_id", profileId)
    .eq("status", "sent")
    .gte("created_at", cutoff)
    .order("score", { ascending: false })
    .limit(5);

  const now = Date.now();
  const recent = await loadRecentSends(profileId, now);
  const flagOn = process.env.REPLY_INTENT_ENABLED === "1";

  return (data ?? []).map((row) => {
    const draft = row.draft_reply;
    const statusUrl = buildStatusUrl(row.author_handle, row.source_tweet_id);
    const replyUrl =
      draft && flagOn ? buildReplyIntentUrl(row.source_tweet_id, row.author_handle, draft) : statusUrl;
    const verdict = draft
      ? checkCaps({ now, draft, targetHandle: row.author_handle, recent })
      : { ok: true as const, blocks: [] };
    return {
      alertId: row.id,
      authorHandle: row.author_handle,
      text: row.tweet_text,
      url: statusUrl,
      replyUrl,
      draft,
      blockedBy: verdict.blocks,
      score: Math.round(row.score * 100),
      freshness: freshnessLabel(row.created_at, now),
      latencyMin: Math.round(row.latency_ms / 60_000),
    };
  });
}
```
(`toSniperPin` is now subsumed; delete it and its references, or keep it only if another caller uses it — grep `toSniperPin` first.)

- [ ] **Step 3: Add `markSniperReplySent` (logs the manual send → feeds caps)**

Append to `src/server/sniper.ts`:
```ts
export async function markSniperReplySent(
  profileId: string,
  alertId: string,
  sentText: string,
): Promise<void> {
  const sb = supabaseService();
  const { error } = await sb
    .from("sniper_alerts")
    .update({ status: "acted", sent_at: new Date().toISOString(), sent_reply_text: sentText })
    .eq("id", alertId)
    .eq("profile_id", profileId)
    .eq("status", "sent"); // idempotent: only an un-acted alert transitions
  if (error) throw new Error(`marking sniper reply sent failed: ${error.message}`);
  await logActivity(sb, profileId, "sniper_reply_sent", { refId: alertId });
  revalidatePath("/engage");
}
```

- [ ] **Step 4: Add the server action**

In `src/server/sniper-actions.ts`:
```ts
import { markSniperReplySent } from "@/server/sniper";

export async function confirmSentReply(
  profileId: string,
  alertId: string,
  sentText: string,
): Promise<void> {
  await markSniperReplySent(profileId, alertId, sentText);
}
```

- [ ] **Step 5: Typecheck + tests**

Run: `npm run typecheck`
Run: `npx vitest run src/server/sniper.test.ts`
Expected: PASS (fix any test referencing the removed `toSniperPin` or the old `SniperPin` shape).

- [ ] **Step 6: Commit**

```bash
git add src/server/sniper.ts src/server/sniper-actions.ts
git commit -m "feat(sniper): pins carry draft + cap verdict; log manual reply sends"
```

---

## Task 9: Swipe/Send card UI

Upgrade `SniperPins` into the manual-send card: show the draft (editable), Send = open the reply intent (gesture-synchronous) + log via `confirmSentReply`, Skip = `actOnSniperAlert(..., 'dismissed')`. Cap-blocked cards disable Send and show why.

**Files:**
- Modify: `src/components/sniper-pins.tsx`

- [ ] **Step 1: Rewrite the component**

```tsx
"use client";
import { useState, useTransition } from "react";
import { actOnSniperAlert } from "@/server/sniper-actions";
import { confirmSentReply } from "@/server/sniper-actions";
import type { SniperPin } from "@/server/sniper";

const BLOCK_LABEL: Record<string, string> = {
  daily: "50/day cap reached",
  hourly: "20/hr cap reached",
  per_account: "already replied 3× to this account today",
  link: "draft contains a link (not allowed in replies)",
  near_duplicate: "too similar to a recent reply",
};

export function SniperPins({ profileId, pins: initial }: { profileId: string; pins: SniperPin[] }) {
  const [pins, setPins] = useState(initial);
  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(initial.map((p) => [p.alertId, p.draft ?? ""])),
  );
  const [pending, startTransition] = useTransition();

  if (pins.length === 0) return null;

  function remove(alertId: string) {
    setPins((p) => p.filter((x) => x.alertId !== alertId)); // optimistic — window is minutes
  }

  // Send MUST run inside the tap gesture (window.open / clipboard need it). We open
  // first, then log. Edited text re-derives the intent URL so the human sends what
  // they see.
  function send(p: SniperPin) {
    const text = (drafts[p.alertId] ?? "").trim();
    const url =
      p.draft && text && p.replyUrl.includes("intent/post")
        ? p.replyUrl.replace(/text=[^&]*/, `text=${encodeURIComponent(`@${p.authorHandle.replace(/^@+/, "")} ${text}`)}`)
        : p.replyUrl;
    window.open(url, "_blank", "noopener,noreferrer");
    remove(p.alertId);
    startTransition(() => confirmSentReply(profileId, p.alertId, text).catch(() => {}));
  }

  function skip(alertId: string) {
    remove(alertId);
    startTransition(() => actOnSniperAlert(profileId, alertId, "dismissed").catch(() => {}));
  }

  return (
    <div className="mb-5 space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-500">
        🎯 Sniper — be first
      </div>
      {pins.map((p) => {
        const blocked = p.blockedBy.length > 0;
        return (
          <div key={p.alertId} className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[13px] font-medium">@{p.authorHandle}</span>
              <span className="text-[11px] text-muted-foreground">
                {p.freshness} · detected in {p.latencyMin}m · score {p.score}
              </span>
            </div>
            <p className="text-[13px] text-muted-foreground line-clamp-3 mb-2">{p.text}</p>

            {p.draft !== null && (
              <textarea
                value={drafts[p.alertId] ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [p.alertId]: e.target.value }))}
                rows={2}
                className="w-full text-[13px] rounded-md border border-border bg-background p-2 mb-2"
              />
            )}

            {blocked && (
              <div className="text-[11px] text-red-500 mb-2">
                ⚠ {p.blockedBy.map((b) => BLOCK_LABEL[b] ?? b).join(" · ")}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                disabled={pending || blocked}
                onClick={() => send(p)}
                className="text-[12px] px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-500 font-medium disabled:opacity-40"
              >
                Send ↗
              </button>
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground"
              >
                Open tweet
              </a>
              <button
                disabled={pending}
                onClick={() => skip(p.alertId)}
                className="text-[12px] px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground"
              >
                ⏭️ Skip
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```
Note on "swipe": the gate's functional core is Send/Edit/Skip above. Touch-swipe gestures (right=Send, left=Skip) are pure polish — add later with a gesture lib only if validation users ask. Do NOT block the gate on gesture UX.

- [ ] **Step 2: Typecheck + build**

Run: `npm run typecheck`
Run: `npm run build` (catches the `"use client"` boundary + server-action import wiring)
Expected: PASS.

- [ ] **Step 3: Manual smoke (local)**

Run the app; open `/engage` with at least one `sent` alert that has a `draft_reply`. Verify: draft shows editable; **Send** opens an X intent URL in a new tab; the card disappears; a refetch shows the alert as `acted` with `sent_at`/`sent_reply_text` set. With `REPLY_INTENT_ENABLED` unset, **Send** opens the status URL instead.

- [ ] **Step 4: Commit**

```bash
git add src/components/sniper-pins.tsx
git commit -m "feat(sniper): manual-send card — edit draft, open reply-intent, log + cap-gate"
```

---

## Task 10: Seed in-band handles

Replace the oversized 100k+ watch list with 4–6 handles in the 2.6–13k band (run `x-target-finder` for @FCisco95's niche to pick them, then encode here).

**Files:**
- Create: `supabase/seeds/2026-06-22-inband-handles.sql`

- [ ] **Step 1: Write the seed (fill the 4–6 chosen handles)**

```sql
-- GATE-1: retire oversized seeds, add in-band (2.6–13k) handles for @FCisco95.
-- Replace <PROFILE_ID> and the handle list with x-target-finder output before running.
update public.watch_targets set active = false
  where profile_id = '<PROFILE_ID>' and active = true;

insert into public.watch_targets (profile_id, handle, priority, active) values
  ('<PROFILE_ID>', '<handle1>', 5, true),
  ('<PROFILE_ID>', '<handle2>', 5, true),
  ('<PROFILE_ID>', '<handle3>', 4, true),
  ('<PROFILE_ID>', '<handle4>', 4, true)
on conflict (profile_id, handle) do update set active = true, priority = excluded.priority;
```

- [ ] **Step 2: Apply against the dev DB and verify**

Run the seed (psql / Supabase SQL editor). Then confirm:
```sql
select handle, priority, active from public.watch_targets
where profile_id = '<PROFILE_ID>' and active = true;
```
Expected: only the 4–6 in-band handles active.

- [ ] **Step 3: Commit**

```bash
git add supabase/seeds/2026-06-22-inband-handles.sql
git commit -m "chore(sniper): seed in-band watch handles; retire oversized seeds"
```

---

## Definition of Done (gate)

- [ ] Reply drafts cannot post via AdsPower (Task 2 test green).
- [ ] `REPLY_INTENT_ENABLED=1` set in env; Send opens the native reply composer pre-filled; fallback to status URL verified with the flag off.
- [ ] Caps block a 3rd-same-account / link / near-dup / over-rate send (unit + a manual check).
- [ ] One real alert taken end-to-end on an in-band handle: detect → draft → notify (PWA + Telegram) → manual send → `sniper_alerts` row shows `status='acted'`, `sent_at`, `sent_reply_text`.
- [ ] Full suite green: `npx vitest run`.

## Out of scope (do NOT build here)
Official X API source adapter · studio AdsPower removal · Apify resilience · twitterapi.io/Grok adapters · touch-swipe gestures · billing/tiers · GDPR LIA. (Per spec §9.)
