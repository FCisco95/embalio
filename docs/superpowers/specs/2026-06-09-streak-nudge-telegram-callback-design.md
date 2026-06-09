# Phase 1b — Retention layer (streak · nudge · Telegram callback) — design

**Date:** 2026-06-09
**Branch (to cut):** `feat/streak-nudge` off `feat/recording-cockpit`
**Predecessor:** Phase 1a (credibility gate + daily coach), `docs/handoffs/2026-06-08-growth-operator-phase1a.md`
**Source spec (locked context):** `cisco-brain/10 - PROJECTS/Embalio/specs/2026-06-08-growth-operator-design.md` §6 (Retention layer)

## 1. Goal

Make the daily-coach loop *sticky*. Phase 1a gives one gated assignment a day; Phase 1b
adds the retention mechanics that bring the user back to it. Scope is **exactly three
things** — a streak, one daily nudge, and the (currently dead) Telegram Posted/Skip
callback. Nothing else.

## 2. Locked decisions (from the source spec §6 — do not re-litigate)

- **Streak** + **endowed progress** (never start at 0/X) + **silent retroactive freezes**
  (+48% streak-days, no guilt) + **grace period / one repair**.
- **Tiny mandatory core that "counts"**, decoupled from the ideal day (Duolingo decoupling
  → +40% reaching 7-day streaks).
- **One loss-framed nudge/day**, hard cap ~1/day, per-user send-time, **silent opt-out
  after 5 ignored**.
- **ADHD-safe:** reward action, never punish inaction; playful not shaming; recoverable
  misses.

## 3. Decisions made this session

1. **Streak unit = one real action.** ≥1 reply OR 1 original *actually posted* today ticks
   the day. The full assignment (post + reply quota) stays the shown "ideal" but is not
   required to keep the streak. This is the spec's decoupled tiny-core.
2. **A "real action" is read from the `posts` table** (`posted_at` is today, any draft
   kind) — the same source the coach already reads. The Telegram "Posted" tap creates a
   `posts` row, so it ticks the streak for free; no separate activity log.
3. **Endowed progress is honest.** The streak *counter* starts at 0 and only ever counts
   real days — no fabricated days (honors the no-fake-numbers rule). Endowment lives only
   in the weekly *ring view*: 2 of 7 segments render pre-filled, labelled a "head start."
4. **Telegram callback transport = local getUpdates long-poll.** No public URL, no deploy;
   matches the existing "pulse is local" model. The callback handler is written
   transport-agnostic (a pure `parseCallback` + a reusable `applyCallback`) so a Vercel
   webhook can be added later with no rewrite. We do **not** `setWebhook` (getUpdates and
   webhooks are mutually exclusive).
5. **Nudge + poll routes are cloud-safe** (no `claude`), `CRON_SECRET`-gated like
   `targeting`/`tracking`, but **triggered locally** during dogfood (a local scheduler) to
   match decision 4. They are ready to drop into `vercel.json` later.
6. **One additive migration** `0012_retention` (a `retention jsonb` column on `profiles`).
   Deliberately *not* zero-migration like 1a — a dedicated column is correct; overloading
   `growth_plan` would be the tech debt.
7. **Freeze params:** earn +1 freeze each time the streak crosses a multiple of 7, capped
   at 2 banked; one manual `repairStreak` available once per 7 days.

## 4. Data model

Migration `0012_retention`: add `retention jsonb not null default '{}'::jsonb` to
`profiles`. Reflect into `src/lib/supabase/types.ts` by hand (repo convention). Logical
shape (all keys optional; absent = sensible default in the engine):

```ts
type Retention = {
  streak?: {
    current: number;             // consecutive streak days; real actions only
    longest: number;
    lastActiveDate: string | null;  // 'YYYY-MM-DD', server-local
    freezesAvailable: number;       // banked silent freezes, 0..2
    freezeDatesUsed: string[];      // days a freeze silently covered (audit/UX)
    brokenFrom: number | null;      // streak value at the last single-day break; null once repaired or stale
    lastRepairDate: string | null;  // last manual repair; gates one repair / 7 days
  };
  nudge?: {
    lastSentDate: string | null;    // 'YYYY-MM-DD'
    consecutiveIgnored: number;     // resets to 0 on any real action
    optedOut: boolean;              // true (silently) after 5 ignored
    sendHour: number;               // 0..23, per-user send-time; default 9
  };
  telegram?: {
    offset: number;                 // getUpdates cursor (last update_id + 1)
  };
};
```

Dates are computed with the same server-local `YYYY-MM-DD` helper the coach uses
(`isToday` precedent in `src/server/coach.ts`). A shared `today()`/`localDate()` helper in
`src/lib/retention/date.ts` keeps the boundary consistent and testable.

## 5. Components

Mirrors the Phase 1a layering: **pure logic** (`src/lib/retention/*`) under unit test,
**thin server seams** (`src/server/*`) that read/write Supabase and call the pure core,
**routes** for triggers, **one card** on the dashboard.

### 5.1 Streak engine — `src/lib/retention/streak.ts` (pure)

- `tickStreak(state, today, hadActionToday): StreakState`
  - `hadActionToday=false` → state unchanged (never punish inaction).
  - action & `lastActiveDate === today` → no double count.
  - action & `lastActiveDate === yesterday` → `current + 1`.
  - action & gap > 1 day → **auto-apply banked freeze(s)** to cover each missed day
    (decrement `freezesAvailable`, push to `freezeDatesUsed`), preserving `current + 1`;
    if not enough freezes, record `brokenFrom = <pre-reset current>` (only for a *single*
    missed day) and reset `current` to 1.
  - On every increment, recompute `longest`, award freezes (+1 per 7-crossing, cap 2), and
    clear a stale `brokenFrom`.
- `repairStreak(state, today): StreakState` — the manual backstop when a freeze didn't cover
  a single missed day. Offered only while `brokenFrom` is set, and only once per 7 days
  (`lastRepairDate` gate). Bridges that one missed day (restores the streak as if it had
  been frozen, plus today), then clears `brokenFrom` and stamps `lastRepairDate`. Exact
  arithmetic is pinned by the engine's tests.
- `streakView(state, today): StreakView` — display model: `{ current, longest,
  ring: { filledReal, endowed: 2, total: 7 }, atRisk, freezesAvailable }`. `atRisk` =
  active streak (`current > 0`) and no action yet today.

### 5.2 Streak seam — `src/server/streak.ts`

- `getStreak(profileId): Promise<StreakView>` — read `retention.streak` + today's `posts`
  (reuse the coach's posts read shape) → `tickStreak` → persist if changed → return
  `streakView`. Lazy update on dashboard load, like the coach. Defensive: on any DB error,
  return a neutral zero-streak view (never throw into the dashboard).

### 5.3 Streak card — `src/components/streak-card.tsx`

Small RSC card beside the coach card on `src/app/(app)/page.tsx`: flame + `current`-day
count, the 7-segment ring (2 endowed + filled real), and an `atRisk` hint ("one reply keeps
it"). No interactivity beyond a link to Compose/Engage. `repairStreak` surfaces only when a
streak just broke (a single "Restore streak" action wired through a server action).

### 5.4 Nudge engine — `src/lib/retention/nudge.ts` (pure)

- `decideNudge(input): { send: boolean; text?: string }` where input =
  `{ state.nudge, today, now, hadActionToday, streakCurrent }`.
  - Send only if: `now`'s hour ≥ `sendHour`, `lastSentDate !== today`, `!optedOut`,
    `!hadActionToday`.
  - Frame: `streakCurrent >= 2` → loss-frame ("Don't lose your N-day streak — one reply
    keeps it"); else gentle starter ("One post or reply today gets your streak going").
- `accrueIgnored(state.nudge, today, hadActionYesterday): nudge` — lazy accounting run at
  the *start* of each nudge decision: if a nudge was sent on the prior day and that day had
  no action, `consecutiveIgnored + 1`; at 5 → `optedOut = true`. Avoids any end-of-day job.
- **Reset is owned here, driven by observed action** (not cross-called from elsewhere): in
  the same pass, `hadActionToday === true` → `consecutiveIgnored = 0`, `optedOut = false`
  (recoverable, ADHD-safe re-opt-in). The nudge pass reads posts itself, so no other module
  has to touch nudge state.

### 5.5 Nudge seam + route — `src/server/nudge.ts`, `src/app/api/nudge/route.ts`

- `runNudge(profileId)`: read `retention.nudge` + posts (today + yesterday) → `accrueIgnored`
  → `decideNudge` → if `send`, `sendTelegram(text)` and set `lastSentDate = today` → persist.
- Route: `GET /api/nudge`, `cronAuthError` gate, cloud-safe (no `claude`). Self-guards on
  `sendHour`, so a local hourly trigger is safe (only one send/day lands). Not added to
  `vercel.json` yet (local dogfood); ready to add later.

### 5.6 Telegram callback — `src/lib/telegram-callback.ts` (pure) + seam + route

- `parseCallback(data: string): { action: 'posted' | 'skip'; candidateId: string } | null`
  — parses the existing `posted:${id}` / `skip:${id}` payloads; null on anything else.
- `src/lib/telegram.ts` gains `getTelegramUpdates(offset, opts?)` → calls Telegram
  `getUpdates`, returns `{ callbacks: {id, data, messageId, chatId}[], nextOffset }`.
  `answerCallbackQuery(id, text?)` and an optional `editMessageReplyMarkup`/`editMessageText`
  to tick the tapped message to ✓. (Injectable `fetchImpl` like `sendTelegram`.)
- `src/server/telegram-poll.ts`:
  - `applyCallback(profileId, {action, candidateId})` — `posted` → mark the candidate's
    latest reply draft (kind=reply) `posted` and insert a `posts` row from it, so the tap
    dedups **and ticks the streak** (the nudge pass then auto-resets opt-out off the new
    `posts` row — no nudge state touched here); `skip` → dismiss candidate (reuse the
    existing `dismissCandidate` path). Idempotent (a re-delivered update is a no-op if the
    candidate is already resolved).
  - `drainTelegramUpdates(profileId)` — read `retention.telegram.offset` →
    `getTelegramUpdates` → for each callback `parseCallback` + `applyCallback` +
    `answerCallbackQuery` → persist `nextOffset`.
- Route: `GET /api/telegram/poll`, `cronAuthError` gate. Hit ~every minute by the local
  scheduler while dogfooding. We never `setWebhook`. `applyCallback`/`parseCallback` are
  transport-agnostic — a future Vercel webhook route reuses them verbatim.

## 6. Triggers (dogfood)

Documented in `docs/HANDOFF.md`, not coded as infra: a local scheduler (Windows Task
Scheduler / launchd) issues, while `npm run dev` is up:
- `GET /api/telegram/poll` every ~1 min (drains taps).
- `GET /api/nudge` hourly (route self-guards on `sendHour`).
Both with the `Authorization: Bearer $CRON_SECRET` header, like the existing pulse smoke
test. No new env vars beyond the already-set `TELEGRAM_*` and `CRON_SECRET`.

## 7. Error handling

- Every server seam is defensive: a Supabase/Telegram failure logs (`String(err).slice(0,
  200)`, repo convention) and degrades — `getStreak` returns a zero view, `runNudge`/`drain`
  return a no-op result with an error flag, never throwing into the dashboard or the cron.
- `sendTelegram`/`getTelegramUpdates` already retry transient 5xx via `withRetry`.
- `applyCallback` is idempotent so duplicate update deliveries are safe.

## 8. Testing (Vitest; boundary mocks like Phase 1a)

Pure (no mocks):
- `streak.ts`: consecutive tick, same-day no-double, single-gap-with-freeze, multi-gap
  exhausting freezes → reset, freeze award at 7-crossings + cap 2, `repairStreak` window,
  `streakView` endow/atRisk.
- `nudge.ts`: time gate, already-sent guard, no-nag-after-action, opt-out at exactly 5,
  frame switches at streak≥2, `accrueIgnored` lazy increment, `resetOnAction`.
- `telegram-callback.ts`: posted / skip / garbage.
- `date.ts`: local-date boundaries.

Seams (mock `fetch` for Telegram + a supabase stub, exactly like the existing tests):
- `getStreak` persists only on change; defensive on DB error.
- `runNudge` sends + sets `lastSentDate`; respects opt-out; cloud-safe (no generate import).
- `drainTelegramUpdates`: posted → candidate posted + posts row + offset advance; skip →
  dismiss; idempotent re-delivery; offset persisted.

Target: all new pure units + seams green, existing 366 still pass, `tsc` + `next build`
clean.

## 9. Scope guard (hold the line)

**In:** the streak (engine + view + card + repair), one loss-framed daily nudge (engine +
route), the Telegram getUpdates callback (parse + drain + route). The single migration.

**Out (explicitly deferred / not built):** leaderboards, badges, points/currency, XP,
email/push beyond Telegram, multi-channel, weekly summaries, a settings UI beyond the
`sendHour` value, the Vercel webhook, `setWebhook`, any change to the pulse drafting loop,
and any change to the credibility gate or coach logic.

## 10. Open questions

None blocking. Freeze params (7-crossing, cap 2, one repair/week) are tunable constants in
`streak.ts` — adjustable after dogfood without schema change.
