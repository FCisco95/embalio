# GOAL LOG — GATE-2 objective ledger

Append-only. One entry per objective. This file is how the next `/goal` session
resumes; read it with `docs/HANDOFF.md` before re-orienting.

**Mission:** by 2026-09-04, a computable GATE-2 scorecard proving assisted
replies move OON reach. Ladder: `2026-08-10` evidence expires ·
`~2026-08-19` last safe trial start · `2026-09-04` gate.

**Forks decided 2026-08-02:** gate = **(a) sprint the dogfood** (keep all 3 legs);
trial = **concierge** (owner drives 3 stranger accounts; O6 stays parked, no auth
build).

---

## 2026-08-02 · ORIENT

Baseline re-verified against prod: `main` @ `1a77c71`, prod 200s, scorecard
unchanged — precision **3%** (2 acted / 66 skipped), cleared-2× **0 of 0**,
visit lift **—** ("no analytics imported yet"). Suite 759 pass / 1 skip.
No drift from the 2026-08-01 baseline.

## O1 — F2 tenant guard on sniper server actions · **DONE** · `e3408a3`

**Shipped:** `ownerMismatch()` FIXED_PROFILE_ID check on all four exports of
`src/server/sniper-actions.ts`, running before `createManualAlert`'s two
embedding calls. +6 tests (765 pass / 1 skip). tsc + build green. Live on prod,
`/engage` and `/performance/gate-2` both 200 with expected content.

**Verification overturned the plan.** The audit's prescribed fix — copy the
ownership guard from `targeting-actions.ts:7` — **cannot work**. That guard reads
`profiles` via the anon key under a `user_id = auth.uid()` RLS policy, and the
app has no auth layer (`src/proxy.ts` is a no-op), so `auth.uid()` is always NULL
and the read matches zero rows *for everyone*. Copying it would have thrown on
the owner's own manual-sniper submit — breaking the exact loop this mission
depends on igniting.

**Therefore O1 does not close F2, and does not claim to.** The mutations were
already profile-scoped (`.eq("profile_id", …)`), and the attacker uses the
*correct* profile id, which is published in the public RSC payload. What shipped
blocks foreign-tenant writes and gives multi-profile work one choke point.
**F2 closes only via Vercel Deployment Protection (owner, ~2 min) or F1 auth.**

**Side finding, unfixed:** `refreshTargets` in `src/components/refresh-button.tsx`
uses that same broken guard → the Refresh button on `/targeting` should be
throwing in production today. Added to the owner queue; out of O1 scope.

**Scorecard impact: moved no scorecard number.** It protects the integrity of
the numbers, not their values.

Decision record: `docs/superpowers/plans/2026-08-02-f2-sniper-action-guards.md`

**Next:** O2 — evidence-expiry safeguard.

## O2 — evidence-expiry safeguard · **DONE** · `d29f846`

**Shipped:** `src/lib/gate/expiry.ts` (+11 tests) — `daysUntilWindowExit`,
`windowExitDate`, `clampWindowDays`, `EXPIRY_WARN_DAYS=7`, null-safe on bad
timestamps. `listRecentActedAlerts` now returns `created_at` (the real window
anchor — it had only been returning `sent_at`). Amber per-row chip once an alert
is ≤7d from dropping out, a page banner naming the soonest un-recorded one and
its exit date, and a `?window=45|90|365` switcher (clamped, not trusted) so
aged-out evidence stays reviewable. +4 component tests on a pinned clock.
Suite 780 pass / 1 skip, tsc + build green.

**Verified live on prod:** `?window=37` renders *"2 un-recorded replies about to
leave the scorecard. @SahilPanhotra drops out today (2026-08-02)"*. At the
default 45d the banner correctly stays silent — the two alerts have 8 days left
and the threshold is 7, so it starts firing **2026-08-03**.

### Baseline correction — `analytics_daily` is stale, not empty

The 365-day view reports **"analytics through 2026-06-11"**. Earlier readings of
"no analytics imported yet" were the *45-day window* being empty, not the table.
So:

- The CSV import path has been used before and works.
- The last import covers through **2026-06-11**; the reply days are
  **2026-06-26**, so there is still zero analytics coverage on the days that
  matter and **visit lift remains uncomputable**.
- The owner action is unchanged (import a fresh CSV) but it is a *refresh of a
  52-day-stale import*, not a first-ever setup.
- At 365d the dismissal count is 67, not 66 — one more sits outside 45 days.

**Scorecard impact: moves no scorecard number.** It stops the two data points the
gate currently rests on from vanishing unnoticed on 2026-08-10, and makes the
history visible again.

**Next:** O3 — precision-metric honesty.

## O3 — precision counts judged alerts only · **DONE** · `b3a0436`

**Decision:** added a `not_reviewed` skip reason meaning "never judged" and
excluded it from the precision and false-alert denominators; it reports as its
own count. **`stale` deliberately still counts against precision** — "aged out
before I could reply" is a real sniper latency failure, and folding it into
not-reviewed would launder a genuine weakness. Rejected the simpler
"exclude stale" option for that reason.

**Shipped:** `computeScorecard` gains `notReviewed`; precision =
`acted / (acted + judged dismissals)`; all-unreviewed → precision `null`, not 0%.
+5 tests (785 pass / 1 skip), tsc + build green, live on prod.

**Two things deliberately NOT done:**
- **The 67 existing rows are not backfilled.** Re-labelling prod rows is an
  owner call, and the rolling window drops them 2026-08-10..08-17 anyway.
  **Precision is not meaningful before ~2026-08-17 regardless of this change.**
- **The migration is written but NOT applied to prod**
  (`supabase/migrations/20260802_skip_reason_not_reviewed.sql`) — this session
  has no DB credentials. Safe to ship unapplied: no runtime path writes the new
  value, only the read side understands it. It drops the auto-named constraint
  by catalog lookup rather than guessing the name.
  **Apply it before any future bulk cleanup uses `not_reviewed`.**

**Scorecard impact: moves no scorecard number today** — prod still shows 3%,
because nothing is labelled `not_reviewed` yet. The change is forward-looking:
the next cleanup can't repeat the distortion, and the card now shows the judged
denominator.

Decision record: `docs/superpowers/plans/2026-08-02-precision-metric-definition.md`

**Next:** O4 — cold start on `/`.

## O4 — home-page latency · **DONE** · `ae820f7`, `38196a8`

**It was never a cold start.** Measured on prod: `/` answered in
**20.0 / 22.3 / 26.5 / 31.7s** across four sequential requests — every request,
climbing — while `/engage` 1.15s, `/performance` 1.44s, `/topics` 1.01s.

Two distinct causes, fixed separately:

1. **`ae820f7` — seven sequential reads.** `page.tsx` awaited
   `listPendingDrafts`, `getDashboardData`, `getGrowthPlan`, `getDailyPlan`,
   `getStreak`, `getFollowerStat`, `getWeeklyActivity` one after another, though
   each only needs the profile id. Now `Promise.allSettled` — chosen over
   `Promise.all` so one failing read degrades its own card, where the shared
   try/catch previously blanked the whole dashboard. → flat ~8.5s.
2. **`38196a8` — two LLM calls on the request path.** The remaining cost was
   `getDailyAssignment`: on any day the owner hasn't posted, it ran
   `findHotTopics` → `gateTrends` inline. Every home-page load paid for live
   trend research and burned tokens. Its only production caller is
   `getDailyPlan`, so it now takes `{ liveTrends, topAngle }` (default `true`,
   so any future caller is unaffected) and the home path feeds the angle from
   the cached topic board it already reads. +3 tests.

**Result, measured warm on prod: 0.85–1.78s** (8 consecutive requests), matching
the sibling routes. First hit after a deploy is ~7–8s cold. **~20× on the page
the daily-habit card lives on.** Plan card verified still rendering assignment +
top topic ("Top topic: MCP ships its biggest spec rewrite…").

Suite 788 pass / 1 skip, tsc + build green.

**Scorecard impact: moves no scorecard number** — but the daily loop this gate
depends on runs through this page, and a 20-30s open was a habit killer.

**Next:** O5 — manual-loop friction.

## O5 — manual-loop friction · **DONE** · `21672f4`

**Shipped:** the manual-submit toast said *"pinned below"*, but `getSniperPins`
renders only the **top 5 by score from the last 3h** — save an alert with five
stronger ones ahead of it and the owner is told it was pinned when it wasn't.
Now reads *"saved — score N · pins show the top 5 by score from the last 3h"*,
in both the clean and advisory-drop branches. +3 component tests (the first for
this form). Suite 791 pass / 1 skip. Verified live: the new string is in the
deployed client chunk `0kdza7pufju9i.js`; `/engage` 200 in 0.99s.

**Half of this objective was stale:** `coach-card.tsx` was already deleted in
`f324c30`. Nothing to remove.

**Scorecard impact: moves no scorecard number.** It removes a false confirmation
from the loop the owner is about to start running daily.

**Next:** O6 — parked; plan doc only.

## O6 — concierge multi-profile · **PLAN ONLY, needs sign-off**

Not implemented, per the ledger. Plan written:
`docs/superpowers/plans/2026-08-02-concierge-multi-profile.md`.

Headline: most of the work already exists — `profiles` is the multi-account row,
`?profile=` is already honoured on `/performance` and `/performance/gate-2`, and
the scorecard is already per-profile. The concierge build is mostly **removing a
single-tenant clamp**, not building tenancy.

**Blocking tension found:** `FIXED_PROFILE_ID` now does two jobs — it scopes what
the app shows *and* it is the tenant guard added in O1 (`ownerMismatch`).
Unsetting it for multi-profile **silently disables that guard**. Recommended fix
is an `OPERATOR_PROFILE_IDS` allow-list that both functions consult.

Also flagged: concierge measures the loop, not the product (strangers never touch
the UI, so it yields reach evidence but no usability evidence), and three
strangers' data would land in a publicly-reachable no-auth app — Deployment
Protection must be confirmed before any of it is entered.

---

# Session summary — 2026-08-02

**Shipped:** `1a77c71` (/goal command) · `e3408a3` O1 · `d29f846` O2 ·
`b3a0436` O3 · `ae820f7` + `38196a8` O4 · `21672f4` O5. All on `main`, all live.
Suite **759 → 791 pass / 1 skip**, tsc + build green throughout.

**The honest headline: no GATE-2 number moved this session, and none could
have.** All three DoD legs are gated on owner actions (see the queue below).
What changed is that the numbers are now harder to corrupt, harder to lose, and
harder to misread — and the daily loop got ~20× faster to open.

| DoD leg | Bar | Start | End |
|---|---|---|---|
| Precision | ≥70% | 3% | 3% (definition fixed; not meaningful before ~2026-08-17) |
| Cleared 2× | ≥3 | 0 of 0 | 0 of 0 |
| Visit lift | ≥+25% | — | — (analytics stale since 2026-06-11) |

**Two corrections to the record:**
- `analytics_daily` is **stale, not empty** — data exists through 2026-06-11; the
  45-day window is what was empty. The import path works and has been used.
- `refreshTargets` (the Refresh button on `/targeting`) appears **already broken
  in production** — it uses an anon-key RLS guard under a `user_id = auth.uid()`
  policy while no auth layer exists. Unverified against a live click; not fixed.

**Owner queue — nothing below can be done by an agent:**

- [ ] **Record both reply outcomes** on `/performance/gate-2`. The page now warns
      you: they drop out of the window **2026-08-10**, and the banner starts
      firing 2026-08-03. After that they stop counting toward precision and
      cleared-2×.
- [ ] **Import a fresh X analytics CSV** on `/performance`. The last one covers
      through 2026-06-11; the reply days are 2026-06-26, so visit lift is
      uncomputable until an import covers them.
- [ ] **Run the first manual sniper paste** on `/engage`. Still 0 rows with
      `source='manual'`.
- [ ] **Turn on Vercel Deployment Protection** — confirmed OFF. It is the only
      thing that actually closes F2, and it gates the concierge trial.
- [ ] **Apply** `supabase/migrations/20260802_skip_reason_not_reviewed.sql`
      before any future bulk cleanup uses `not_reviewed`.
- [ ] **Decide O6** (concierge multi-profile plan) and **start recruiting**. If
      recruitment hasn't started by ~2026-08-12, the trial cannot finish before
      2026-09-04 and the gate should be re-scoped to the owner dogfood.

**Resume: open a fresh session in this repo and run `/goal`.**
