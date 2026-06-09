# Phase 1b (this branch) — Daily nudge + Telegram callback — design

**Date:** 2026-06-09
**Branch:** `feat/nudge-telegram-callback` (renamed from `feat/streak-nudge`), based on
`7af784a` (daily-loop-reward merge) **+ merged `feat/engage-mobile-wedge`** for
`markRepliedQuick` + nullable `posts.tweet_url`.
**Source spec (locked context):** `cisco-brain/10 - PROJECTS/Embalio/specs/2026-06-08-growth-operator-design.md` §6

## 0. Why this scope is narrower than the original 1b

Phase 1b ("streak + nudge + Telegram callback") is being built by **multiple agents in
parallel**. Mid-session two sibling streams landed overlapping work:

- **daily-loop-reward** (merged into `feat/recording-cockpit` as `7af784a`): a basic
  streak (`src/lib/streak.ts` `computeStreak`, UTC consecutive posting days, stateless),
  `getStreak` server action, a `StreakBadge`, a reward beat (chime + particle burst), and a
  gated trend-radar one-tap "Draft this → queue".
- **engage-mobile-wedge** (`feat/engage-mobile-wedge`, merge-ready): bot/bait target
  demotion, scoring, `markRepliedQuick`, nullable `posts.tweet_url`, PWA manifest, mobile
  bottom-nav.

Per a file-ownership contract (parallel-feature-development), **this branch owns only the
two remaining locked-1b pieces that touch separate files: the loss-framed daily nudge and
the dead Telegram Posted/Skip callback.** The streak's silent-freeze / endowed-progress /
grace-repair science is **out of scope here** — it edits the streak owner's `streak.ts` and
must be assigned to that owner (or done as a sequenced follow-up after they land).

## 1. Coordination contract (do not violate)

- **`src/server/posts.ts` is owned by engage-wedge.** Do NOT add handlers there. **Import**
  `markRepliedQuick`, `markPosted`, `dismissCandidate`.
- **`markRepliedQuick(profileId, {draftId?, candidateId?, reply})`** — logs a URL-less reply
  post (ticks the coach `repliesDoneToday` and the posts-derived streak) + marks the draft
  posted + the candidate engaged. **Reuse it for a "Posted" tap.**
- **`getStreak(profileId): Promise<number>`** (daily-loop-reward) — read-only import for the
  nudge's loss-frame. Treat its signature as a fixed contract.
- **`src/lib/supabase/types.ts`** — `posts.tweet_url` is already nullable on the live DB; do
  NOT regenerate it back to non-null. My `retention` change is an **additive** hand-edit to
  the `profiles` Row/Insert/Update types only.
- **Untouched sibling files:** `bait.ts`, `scoring.ts`, `targeting.ts`, `engage-queue.ts`,
  `engage/page.tsx`, `engage-queue-panel.tsx`, `app/{manifest,icon,apple-icon,layout}.tsx`,
  `components/shell/*`, `api/cron/tracking/route.ts`, and all streak/reward/radar files.

## 2. Locked retention mechanics that apply to the nudge (source spec §6)

- **One loss-framed nudge/day**, hard cap ~1/day, per-user send-time, **silent opt-out after
  5 ignored**.
- **ADHD-safe:** reward action, never punish inaction; playful not shaming; recoverable.

## 3. Decisions

1. **Callback transport = local getUpdates long-poll** (no public URL, no `setWebhook`).
   `parseCallback` + the drain logic are transport-agnostic so a Vercel webhook can reuse
   them later.
2. **Nudge + poll routes are cloud-safe** (no `claude`), `CRON_SECRET`-gated like
   `targeting`/`tracking`, but triggered by a **local scheduler** during dogfood.
3. **One additive migration** `20260609_profiles_retention.sql` (timestamp naming — `0012_`
   is taken by `algorithm_briefs`). A `retention jsonb` column on `profiles` holds nudge
   bookkeeping + the getUpdates offset. (The streak stays stateless/posts-derived — it does
   not use this column.)
4. **"Real action today"** for the nudge gate is read from `posts` (`posted_at` today, any
   kind) — the same source `getStreak` uses. A "Posted" tap creates a `posts` row via
   `markRepliedQuick`, so it satisfies the gate and resets the ignore counter for free.

## 4. Data model

Migration `supabase/migrations/20260609_profiles_retention.sql`:
`alter table profiles add column retention jsonb not null default '{}'::jsonb;`
Hand-reflect into `src/lib/supabase/types.ts` (additive; `profiles` only). Logical shape:

```ts
type Retention = {
  nudge?: {
    lastSentDate: string | null;   // 'YYYY-MM-DD' server-local
    consecutiveIgnored: number;    // resets to 0 on any real action
    optedOut: boolean;             // true (silently) after 5 ignored
    sendHour: number;              // 0..23, per-user send-time; default 9
  };
  telegram?: { offset: number };   // getUpdates cursor (last update_id + 1)
};
```

A shared local-date helper `src/lib/retention/date.ts` (`localDate(d): 'YYYY-MM-DD'`,
`isSameDay`) keeps the boundary consistent and unit-testable.

## 5. Components

Mirrors Phase 1a: **pure logic** (`src/lib/**`) under unit test, **thin server seams**
(`src/server/**`), **routes** for triggers.

### 5.1 Nudge engine — `src/lib/nudge.ts` (pure)

- `decideNudge(input): { send: boolean; text?: string }`, input =
  `{ nudge, today, now, hadActionToday, streakCurrent }`.
  - Send only if: hour(`now`) ≥ `sendHour`, `lastSentDate !== today`, `!optedOut`,
    `!hadActionToday`. Hard cap 1/day via `lastSentDate`.
  - Frame: `streakCurrent >= 2` → loss-frame ("Don't lose your N-day streak — one reply
    keeps it"); else gentle starter ("One post or reply today gets your streak going").
- `accrueIgnored(nudge, sentYesterday, hadActionYesterday): nudge` — lazy, run at the start
  of each decision: prior-day nudge sent + that day had no action → `consecutiveIgnored + 1`;
  at 5 → `optedOut = true`. No end-of-day job.
- **Reset owned here, driven by observed action:** in the same pass `hadActionToday === true`
  → `consecutiveIgnored = 0`, `optedOut = false` (recoverable re-opt-in). No other module
  touches nudge state.

### 5.2 Nudge seam + route — `src/server/nudge.ts`, `src/app/api/nudge/route.ts`

- `runNudge(profileId)`: read `retention.nudge`; read `posts.posted_at` for today + yesterday
  (own query — read-only, does not edit `posts.ts`); `getStreak(profileId)` for the frame →
  `accrueIgnored` → `decideNudge` → on `send`, `sendTelegram(text)` + set `lastSentDate` →
  persist `retention.nudge`. Defensive: any DB/Telegram error logs (`String(err).slice(0,
  200)`) and returns a no-op result, never throws.
- Route `GET /api/nudge`, `cronAuthError` gate, cloud-safe (no `claude`/generate import).
  Self-guards on `sendHour`, so an hourly local trigger lands at most one send/day. Not added
  to `vercel.json` yet.

### 5.3 Telegram getUpdates — `src/lib/telegram.ts` (extend) + `src/lib/telegram-callback.ts` (pure)

- Extend `src/lib/telegram.ts` (mine to extend — no sibling claims it):
  - `getTelegramUpdates(offset, opts?)` → `{ callbacks: {id, data, messageId, chatId}[],
    nextOffset }` via Telegram `getUpdates` (injectable `fetchImpl`, like `sendTelegram`).
  - `answerCallbackQuery(id, text?, opts?)` and an optional `editMessageText`/markup to tick
    the tapped message to ✓.
- `src/lib/telegram-callback.ts` — pure `parseCallback(data): { action: 'posted' | 'skip';
  candidateId: string } | null` (parses the existing `posted:${id}` / `skip:${id}` payloads).

### 5.4 Callback drain seam + route — `src/server/telegram-poll.ts`, `src/app/api/telegram/poll/route.ts`

- `applyCallback(profileId, { action, candidateId })` — imports from `posts.ts`:
  - `posted` → look up the candidate's latest reply draft (id + body) →
    `markRepliedQuick(profileId, { draftId, candidateId, reply: body })`. Idempotent: if the
    candidate is already `engaged`/`dismissed`, no-op.
  - `skip` → `dismissCandidate(candidateId)`.
- `drainTelegramUpdates(profileId)` — read `retention.telegram.offset` → `getTelegramUpdates`
  → for each callback: `parseCallback` → `applyCallback` → `answerCallbackQuery` (+ tick the
  message). Persist `nextOffset` into `retention.telegram.offset`. Defensive like the nudge.
- Route `GET /api/telegram/poll`, `cronAuthError` gate. Hit ~every minute by the local
  scheduler. We never `setWebhook`. `parseCallback`/`applyCallback` reused verbatim if a
  Vercel webhook is added later.

## 6. Triggers (dogfood) — documented in `docs/HANDOFF.md`, not coded as infra

While `npm run dev` is up, a local scheduler (Windows Task Scheduler / launchd) issues, with
`Authorization: Bearer $CRON_SECRET`:
- `GET /api/telegram/poll` every ~1 min (drains taps).
- `GET /api/nudge` hourly (route self-guards on `sendHour`).
No new env vars beyond the already-set `TELEGRAM_*` and `CRON_SECRET`.

## 7. Error handling

Every seam is defensive (degrade, log `String(err).slice(0,200)`, never throw into a cron or
the dashboard). `sendTelegram`/`getTelegramUpdates` retry transient 5xx via `withRetry`.
`applyCallback` is idempotent so duplicate update deliveries are safe.

## 8. Testing (Vitest; boundary mocks like Phase 1a)

Pure (no mocks): `nudge.ts` (time gate, already-sent guard, no-nag-after-action, opt-out at
exactly 5, frame switch at streak≥2, `accrueIgnored`, reset-on-action), `telegram-callback.ts`
(posted / skip / garbage), `date.ts` (local-date boundaries).
Seams (mock `fetch` + a supabase stub, mock `getStreak` + `markRepliedQuick`/
`dismissCandidate` imports): `runNudge` sends + sets `lastSentDate`, respects opt-out,
cloud-safe (asserts no generate import); `drainTelegramUpdates` posted → `markRepliedQuick`
called + offset advance, skip → `dismissCandidate`, idempotent re-delivery, offset persisted.
Target: new units + seams green, the merged 394 still pass, `tsc` + `next build` clean.

## 9. Scope guard (hold the line)

**In:** the daily loss-framed nudge (engine + seam + route), the Telegram getUpdates callback
(getUpdates/answer helpers + parse + drain + route), the one additive `retention` migration +
types reflection.

**Out (sibling-owned or deferred):** the streak engine/badge/freeze/endow/grace, the reward
beat, the radar redesign, anything in the engage-wedge lane, **any edit to `posts.ts`**, the
Vercel webhook / `setWebhook`, and any change to the coach or credibility gate.

## 10. Open questions

None blocking. Whether to apply the additive migration to the live DB now (for dogfood) or
hand it to the owner is a runtime call at build time — the DDL is additive and safe.
