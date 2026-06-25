# Embalio — Handoff (canonical)

**Last updated:** 2026-06-25 (Session 16 — GATE-2 ignition EXECUTED LIVE; dogfood armed)
**Active branch:** `main` (suite **675 green / 1 skip**, tsc clean). T1–T9 + ignition pushed (`origin/main` @ `0173447`); **3 docs/data commits ahead, UNPUSHED** (LIA · seed file · this handoff — push owner-gated). Trunk policy: direct-to-main, suite-green-gated.
**Production:** **https://embalio.vercel.app** (Vercel Hobby, auto-deploys from main; `GEN_BACKEND=gemini` cloud-side). **Repo PUBLIC since 2026-06-11** (private Actions minutes hit billing wall; history secret-scanned first).
**Scope:** AI **growth-operator** product (repositioned 2026-06-08) — platform-agnostic core (roadmap · daily coach · credibility-gate · brand-voice · gamification) + swappable per-platform packs; X first; dogfood → Stripe. Canonical strategy lives in the cisco-brain vault (paths in Sessions 9-10 below).

This is the canonical, living handoff for this repo. It is auto-loaded at the
start of each session by the `handoff-memory` plugin's SessionStart hook.
Point-in-time session snapshots live in `docs/handoffs/`.

---

## 🗒️ SESSION 16 (2026-06-25) — GATE-2 ignition EXECUTED LIVE (dogfood armed)

**TL;DR:** Walked the live ignition end-to-end with the owner. Migration applied to live Supabase, prod deployed with `REPLY_INTENT_ENABLED=1`, **6 in-band watch handles seeded**, relevance niche **recalibrated to the owner's REAL niche** (AI-dev-tooling-first). Poll pipe confirmed: **`pulled:18`**. `alerts:0` is **timing, not config** — the system is validated; STEP 5 (first real alert) is armed on the schedule.

**What went live (via Supabase MCP / Vercel / git — live state applied independently of the repo):**
- **Migration** `20260622_sniper_manual_send` → applied (live version `20260624215645`): 3 nullable cols + partial index on `sniper_alerts`. Was the deploy-break blocker (code selects `draft_reply`/`sent_at`; without it `/engage` 400s). Verified ordering: migrate **before** push.
- **`REPLY_INTENT_ENABLED=1`** set on Vercel prod (owner, dashboard) → baked into the deploy. Code check is strict `=== "1"` (`sniper.ts:95,288`).
- **Pushed** `main` → prod auto-deploy (`origin/main` @ `0173447`); `npm run build` green pre-flight.
- **Seed** — 6 in-band `watch_targets` for `FCisco95` (id `7a728122-569a-4db0-8773-1e537fd1a92f`): `kaixcreator`(5), `heymike777`(5), `w3_surfer`(5), `dom_gag_96`(4), `saadpastadev`(4), `sahilpanhotra`(3). Retired 4 oversized (`thisiskp_`, `arvidkahl`, `tdinh_me`, `florinpop1705`). Sourced via **Grok** (live X data). Seed file synced (`21b7822`).
- **Niche recalibrated** (`profiles.niche_description` + `content_pillars`, `voice_corpus` untouched). Owner's REAL niche (from a month of posts): solo founder building **Organic** (Solana launchpad on BONK) + **heavy AI-dev-tooling discourse** (Claude Code, model routing, Mythos/Fable, MCP/agents) + content/livestreaming. **Anchor is AI-tooling-FIRST** then Solana then build-in-public. Proven 65k-view reply was AI-tooling (to @KaiXCreator), not Solana — AI-tooling is the reach lane.
- **GDPR LIA** written (`docs/compliance/2026-06-24-gdpr-lia-signal-warehouse.md`, `03bd3ca`) — Art. 6(1)(f) basis before warehousing strangers. **Condition R1:** `signal_tweets` has NO purge (`deleted_at` never written) — ship retention before scaling past the dogfood.

**Prune-by-actuals (real follower counts from first poll):** `heymike777` 2,680 (2.0× ✅), `KaiXCreator` **9,492 (7.2× ✅ in-band — NOT oversized)**. Other 4 quiet this window → keep, verify when they post. **No prune needed.**

**Why `alerts:0` (NOT a bug):** every qualifying post was hours-stale (>180min hard-drop) — late-evening lull. `KaiXCreator`'s viral "Gemini 3.5 vs Fable 5" post (**104 replies / 16,768 views**) was ~18h old when polled → dropped. Caught fresh (<60min) it scores ≈ **0.82** → easy alert. System validated; it just needs to poll a fresh viral post *in-window*.

**NEXT (priority order):**
1. **⭐ POLL-WINDOW MISALIGNMENT (highest leverage, deferred):** cron = `*/15 6-22 UTC` (owner waking hrs, *owner-locked*). Targets (esp. KaiXCreator, US) post viral in **US prime ~20:00–04:00 UTC** — partly OUTSIDE the window → best posts uncatchable fresh. Widen toward 24h (`*/15 * * * *`); cost ~64→96 Apify runs/day. File: `.github/workflows/sniper-poll.yml`.
2. **STEP 5:** let the schedule catch the first fresh Kai-class post → real alert → manual reply → confirm `sniper_alerts.status='acted'`, `sent_at`, `sent_reply_text`.
3. **7–10 day dogfood**, judged on the reach scorecard (visits/day +≥25% traceable to reply days; ≥3 replies each clearing ≥2× author median reply impressions; precision ≥70%).
4. **GDPR LIA R1:** ship `signal_tweets` retention/purge before scaling.
5. **Watch-list tuning:** `heymike777` is mostly low-signal replies — consider swapping for an AI-dev/Claude-ecosystem account (the reach lane); add more in-band AI-tooling handles via Grok.
6. **Recruit 3 strangers** (schedule risk vs 2026-09-04). Week-6 anti-burnout tripwire armed ~2026-07-30.

**Unpushed:** 3 docs/data commits on `main` (LIA `03bd3ca`, seed `21b7822`, this handoff). The live DB/prod changes are already applied via MCP/Vercel — these commits only *document* them. Push is owner-gated.

---

## 🗒️ SESSION 15 (2026-06-22 → 06-24) — Sniper ToS-redesign GATE-1 SHIPPED + GATE-2 ignition merged

**TL;DR:** Built the **ToS-compliant manual-send Sniper** (GATE-1, tasks T1–T9, commits `bfa5831`…`ba4a03c`) — every send opens X's first-party composer (reply-intent or status URL); **no API write, no automation post, ever** (X Automation Rules, Apr 2026; a ban ends the project). Then a **17-agent audit (2026-06-23)** found GATE-2 *can't physically start* — three config/wiring gaps hid under the "shipped" headline. Fixed in `a711ad4` (+2 ride-along fixes), **merged to `main` 2026-06-24**. Suite **631 → 675 green**, tsc clean.

**Strategic pivot — LOCKED, do not re-litigate** (full report: vault `10 - PROJECTS/Embalio/research/Embalio — Improvement Report (2026-06-23).md`; repo-local executable half: `docs/superpowers/notes/2026-06-23-gate2-ignition-reconciliation.md`):
- **P4 Predictions + P6 Strategy Engine are FROZEN** — shipped against the Q3 cut; decorative / disconnected from reach. Zero further investment, no P7 hooks, until GATE-2 clears. Keep their numbers OUT of how GATE-2 is judged.
- **Reach (~0.66% OON out-of-network) is the metric GATE-2 is judged on.** Pass only if sniper replies *measurably move OON reach* — not if "alerts fire."
- **YouTube Phase-1 Studio UI is already in `main`** (not shelved). Frozen-in-place.
- **Deadline: 2026-09-04** — a 3-stranger, 2-week dogfood trial must complete before it.

**What shipped (GATE-1, `src/lib/send/` · `src/lib/engagement/` · `src/server/`):**
- `lib/send/intent.ts` — pure `buildReplyIntentUrl` / `buildStatusUrl` (X first-party composer URLs; human posts by hand).
- `lib/engagement/caps.ts` — pure `checkCaps`/`hasLink`/`similarity`. **Advisory guardrail, NOT server-enforced** (only disables the `/engage` web button; `markSniperReplySent` does no check — you can't hard-block a human from x.com).
- `server/caps.ts` — `loadRecentSends` (24h acted-send window). Caps: ≤3/account/day, 50/day, 20/hr (the 4th/51st/21st blocks).
- `server/sniper.ts` — drafts reply at alert time (best-effort, `GEN_BACKEND=gemini` cloud-side; failure → `draft=null` → status-URL fallback, alert still fires); ships one-tap intent via PWA + Telegram. `getSniperPins` carries draft + cap verdict; `markSniperReplySent` + `confirmSentReply` log manual sends.
- `posting.ts` refuses `kind==='reply'` (AdsPower reply auto-post vector **severed**). T9: manual-send card on `/engage` (edit draft → `window.open` intent synchronously in tap handler → log via `confirmSentReply`; Skip → `dismissed`; cap-blocked cards disable Send).

**GATE-2 ignition (`a711ad4`, merged) — the 3 blockers + 2 ride-alongs, all freeze-safe:**
1. **In-band seed** `supabase/seeds/2026-06-22-inband-handles.sql` — **TEMPLATE ONLY, not filled, not applied.** Watch list is still 100k+ handles so `sizeFit` collapses → sniper fires near-never (Session-12 live-fire = `alerts:0`). Fill 4–6 handles in the 2.6–13k follower band via x-target-finder before any GATE-2 alert.
2. **`REPLY_INTENT_ENABLED`** documented in `.env.example`; **UNSET in prod** → one-tap pre-filled reply is dark, falls back to bare status URL.
3. **Dead Telegram Sent/Skip buttons removed** — their `alert:sent/skip:*` callbacks had no parser and no scheduled drain route (silent no-op). Open & reply + Copy kept; the `/engage` web pin records sends + feeds caps.
4. **Relevance floor** — degenerate/zero embedding now → relevance 0 (was 0.5), so an embedding failure can't clear the 0.6 score threshold on recency+size alone (+test, red→green).
5. **`caps.ts` header honesty** — downgraded "enforced/non-bypassable" → "advisory guardrail."

**Schema / config status:**
- Migration `supabase/migrations/20260622_sniper_manual_send.sql` (3 nullable cols + 1 partial index on `sniper_alerts`) — **written/committed (`bfa5831`), NOT applied to live Supabase.** Additive + idempotent.
- Seed = template (see above). `REPLY_INTENT_ENABLED` unset in prod.

**NEXT — all OWNER-DRIVEN + OUTWARD (Day-1 sequence; an agent must STOP and ask before any of these):**
1. **Decide disposition of the 13 unpushed `main` commits** — push to origin and/or open a PR.
2. **Fill seed** (x-target-finder: 4–6 in-band handles + real @FCisco95 `profile_id`) → **apply migration `20260622`** to live Supabase → **set `REPLY_INTENT_ENABLED=1`** on Vercel prod; verify native composer pre-fills on a phone, then verify status-URL fallback when unset.
3. **Pre-flight:** one manual `workflow_dispatch` of the sniper poll; confirm `pulled>0` for the new handles.
4. **Fire 1 real alert end-to-end** (detect → draft → notify → manual send → `sniper_alerts.status='acted'`, `sent_at`, `sent_reply_text`).
5. **GDPR LIA one-pager BEFORE any stranger's data hits the shared DB** — repo permanently warehouses others' tweets (`signal_tweets.deleted_at` never written, no purge). EDPB Guidelines 1/2024 require the LIA before processing. Overrides the Q3 "defer LIA to first paying client."
6. **Recruit 3 strangers in parallel** — highest schedule risk vs 2026-09-04; no code de-risks it.
7. Free/codeless reach wins alongside (not this repo): strip external links from main tweets (link-in-reply), native video/threads, X Premium.

**Watch / risks:** caps are advisory (no server hard-block) · alert volume ungoverned (~64 polls/day × 3 → 100+ notifs/day possible; consider a daily alert cap for the dogfood) · "$0 Apify" is really *cheap* Apify (paid actor per poll) · predictions receipts duplicate on every `/performance` load (`predict.ts:57`, fix post-gate) · **Week-6 anti-burnout tripwire armed for ~2026-07-30** (auto-audits GATE-2 progress, recommends scope cuts if ignition stalled). **DEFER post-gate:** server-side cap enforcement · P7 (RLS on ~17 service-role tables) · P8 (Stripe/twitterapi.io/Grok adapters — keep OFF) · sniper studio-original-post AdsPower removal (last auto-post vector). **FREEZE:** X API official write (reintroduces the severed auto-post vector).

---

## 🗒️ SESSION 14 (2026-06-18) — P4 Predictions SHIPPED end-to-end

**TL;DR:** P4 (Predictions) built subagent-driven on `feat/predict-module` (15 commits — every task TDD + spec-reviewed + quality-reviewed), merged `--no-ff` to `main`, prod-deployed. **Suite 597 → 631 green** (+34 predict tests). Dogfooded on @fcisco95 before merge. Also fast-forwarded the pending **OAuth-CSRF + postcss security fix** (`fix/oauth-csrf-state-postcss-vuln`) into main at the start of the session.

**Canonical docs (don't re-litigate):**
- Plan (all 12 tasks done): repo `docs/superpowers/plans/2026-06-18-predict-module.md` — includes the spec-review fixes (breakout wiring corrected to the inner `TweetCard`; `analytics_daily` used as a sparse-data fallback rate).
- Spec: vault `10 - PROJECTS/Embalio/specs/2026-06-11-growth-operator-revamp-design.md` §8 (decision 8) + P4 phase row.

**What shipped (new module `src/lib/predict/`, mirrors `lib/kpis/`):**
- `schemas.ts` — zod: `Trajectory`, `WeeklyForecast`, `WhatIfKnobs`, `BreakoutPrecheck`, `PredictionRecord`.
- `regression.ts` — pure `linearRegression()` (OLS, flat-data r2=0 guard) + `ema()`.
- `rate.ts` — `blendedDailyRate()` (shared OLS+EMA blend, snapshot-or-fallback) + `avgDailyFollowsPerDay()` (analytics_daily fallback). DRY core for forecast+trajectory.
- `forecast.ts` — `weeklyForecast()` (AC#3): blended rate → end-of-week prediction + ±1σ band; `endOfWeekUTC()`.
- `trajectory.ts` — `projectTrajectory()` (AC#1): solid history + dashed projection.
- `whatif.ts` — `applyWhatIf()` (AC#2): slider multipliers (product), client-side re-projection.
- `breakout.ts` — `breakoutScore0to100()` + `summarizeBreakout()` (AC#4): maps the existing 1–7 `scoreDraftBreakout()` output → 0–100 + band. **Reuses `buildBreakoutPrompt` — not rewritten.**
- `persist.ts` — `buildPredictionRecord()` (pure receipt builder).
- `src/server/predict.ts` — `getForecastBundle()` (reads `follower_snapshots` + `analytics_daily`, persists trajectory+forecast receipts) + `precheckBreakout()` (calls existing scorer, persists). Result-union, never-throw, mirrors `server/kpis.ts`.
- UI: `src/components/predict/forecast-card.tsx` + `trajectory-chart.tsx` on `/performance` (after KpiGrid); `breakout-chip.tsx` wired into the inner `TweetCard` of `thread-composer.tsx` (0–100 chip replaces the old 1–7 badge).

**Schema:** `supabase/migrations/20260618_predictions.sql` — `predictions` (type CHECK trajectory|weekly_forecast|breakout, value_json jsonb, created_at, expires_at) — **applied live** (project `vzxpakxjnuaesfxihyvl`). RLS disabled (P7 posture). Also added `predictions` to `src/lib/supabase/types.ts`.

**Known follow-ups (non-blocking):**
- No empty-draft guard in `precheckBreakout` (fires LLM on `""`). Cheap hardening.
- `predictions` RLS deferred to **P7** (same posture as the other 17 service-role tables).
- Untracked `src/lib/model-router.ts` left in the working tree (global model-router propagation artifact, unrelated to P4 — not committed).

**NEXT:**
1. Watch the prod deploy of `9f765be` land on https://embalio.vercel.app; spot-check `/performance` Forecast card + `/compose` breakout chip on prod.
2. Backtest loop: the `predictions` receipts now accumulate — later compare `value_json.predictedFollowers` vs realized `follower_snapshots` for accuracy receipts.
3. Resume P5 dogfood items (sniper alerts, Apify burn) from Session 13's NEXT list.

---

## 🗒️ SESSION 13 (2026-06-13) — `feat/recording-cockpit` smoke-tested + closed

**TL;DR:** Branch was already merged into `main` (Sessions 9–12 built on top of it). This session ran the owner-gated smoke tests to formally close it, then deleted local + remote branch. Suite 596 green.

**What happened:**
- Discovered `feat/recording-cockpit` was already an ancestor of `main` — merged across prior sessions, never formally closed.
- **OBS invisibility test**: owner confirmed — overlay NOT visible in Display Capture or Window Capture. `setContentProtection(true)` working.
- **EDL export test**: `session-start`/`session-export` actions are Electron-bridge-only (no browser keyboard binding). Verified via unit tests: `src/lib/studio/markers.ts` — 6/6 pass. Browser cockpit confirmed functional (beat navigation through 13/15 beats).
- **Branch cleanup**: `feat/recording-cockpit` deleted locally + `origin/feat/recording-cockpit` deleted from remote.

**Known EDL caveat**: full file-write path (`bridge.exportMarkers`) only runs inside Electron. Browser dev mode falls back to `console.log`. If you ever need to verify the Electron path, launch with `$env:EMBALIO_PYTHON = "C:\Users\joao_\AppData\Local\Programs\Python\Python311\python.exe"` and use the global hotkeys wired in `desktop/main.js`.

**NEXT (unchanged from Session 12):**
1. **Dogfood week (P5):** wait for first real sniper alert. Add 4-6 smaller in-band handles (2.6k–13k followers) for real alert flow — arvidkahl at 200k fires near-never.
2. **Watch Apify burn** (~1 day); widen cron to `*/20` or `*/30` if burn >$0.50/day.
3. **P4 — Predictions** (3-4 days): open with `superpowers:writing-plans` from spec row. `src/lib/predict/`, trajectory/what-if/breakout pre-check/weekly forecast, `predictions` table receipts.
4. Residual P0: nudge/Telegram trigger dogfood from phone.

---

## 🗒️ SESSION 12 (2026-06-12, night) — P5 Sniper-lite + Push SHIPPED end-to-end, dogfood PASSED

**TL;DR:** P5 (moved ahead of P4 on the P3 readout: reach is the bottleneck) built subagent-driven on `feat/sniper-push` (22 commits, every task TDD + spec-reviewed + quality-reviewed + final integration review = READY TO MERGE), merged fast-forward to `main`, prod-deployed. **Suite 545 → 578 green.** Live-fire dogfood passed: migration applied, VAPID set, 4 watch handles seeded, phone subscribed (FCM), workflow green (`{ok:true, profiles:1, pulled:12, alerts:0}` — correct verdict, all pulls >3h stale), direct web-push test landed on the phone (owner-confirmed).

**Canonical docs (don't re-litigate):**
- Plan (all 12 tasks done): repo `docs/superpowers/plans/2026-06-11-p5-sniper-lite-push.md` — owner-locked decisions incl. **15-min lean cadence** (not the spec's 5-min; Apify budget) and 2-10x band standardization.
- Spec: vault `10 - PROJECTS/Embalio/specs/2026-06-11-growth-operator-revamp-design.md` P5 row + decision 5/6.

**What shipped:**
- Schema: `watch_targets` + `sniper_alerts` (UNIQUE(profile_id, source_tweet_id) idempotency, `latency_ms` = discovery latency, `score_parts` jsonb) + `push_subscriptions` — `supabase/migrations/20260613_sniper.sql`, **applied live**.
- **2-10x size band standardized repo-wide** (was 5-20x): `scoring.ts` `sizeFit`, `knobs.ts` `targetFollowerBand`, `present.ts` `fitBadge`.
- `src/lib/sniper/score.ts` — pure `targetScore()`: playbook §4 weighted sum (0.30 rel / 0.25 reply-velocity / 0.20 recency / 0.15 size-fit / 0.10 followback, × bait multiplier), hard drops (>30 replies / >3h-unless-hot / bait<0.4).
- Web push: `web-push` dep, `src/lib/push.ts` (`PushSubscriptionGone` prune signal), `public/sw.js`, `PushOptIn` on `/engage`, `push_subscriptions` persistence.
- `src/lib/notify.ts` — unified Telegram + web-push fan-out, channel-isolated, dead-sub pruning.
- `src/server/sniper.ts` — `pickAlerts` pure core + `runSniperPoll` (lean pull maxPerHandle 3, warehouse-everything, embed relevance, real follower count from `follower_snapshots`, idempotent upsert, notify, `sniper_alert_sent` activity) + `runSniperPollAll`.
- `/api/cron/sniper` + `.github/workflows/sniper-poll.yml` (`*/15 6-22 * * *` UTC).
- Sniper pins on `/engage` (amber cards, Done/Skip, "detected in Xm" honest latency) + watch-list card on `/board` (capped 10, share-URL paste normalized).
- `scripts/test-push.mjs` — one-off push smoke test (`node --env-file=.env.local scripts/test-push.mjs`).

**Env/infra state:** 4 VAPID vars on Vercel prod + `.env.local` (this machine); `SNIPER_MIN_SCORE` defaults 0.6 (env-overridable); Telegram vars pre-existing; GH needed nothing new (CRON_SECRET/APP_BASE_URL reused). Telegram vars now documented in `.env.example`.

**NEXT (in order):**
1. **Dogfood week:** wait for first REAL alert (watched handle posts fresh → Telegram + push + `/engage` pin + latency row). Watch handles: thisiskp_, arvidkahl, tdinh_me, florinpop1705 — arvidkahl 200k = 155x → near-never alerts (visibility play only); **add 4-6 smaller in-band handles (2.6k-13k followers)** for real alert flow.
2. **Watch Apify burn ~1 day in** (expect ≤$0.50/day; if higher, widen cron to `*/20` or `*/30` — one-line workflow change).
3. **P4 — Predictions** (3-4 days; spec row: `src/lib/predict/`, trajectory/what-if/breakout pre-check/weekly forecast, `predictions` table receipts; full year of `analytics_daily` to fit from). Open with its own `writing-plans` cycle.
4. Residual P0 leftovers: nudge/Telegram trigger dogfood from phone.

**Risks/notes:** 17 tables RLS-disabled (3 new ones included) — Supabase advisor critical, accepted posture, **P7 hardening item**; `WatchTargetsCard` remove-chip is non-optimistic (server round-trip lag, minor UX); sw.js notificationclick force-navigates the first open tab to `/engage` (acceptable v1); count-cap race on concurrent watch adds (single-user, fine); Apify junk empty-row warehoused per poll (text-less skip already guards scoring).

---

## 🗒️ SESSION 11 (2026-06-11, night) — P3 KPI Dashboard + CSV Import BUILT (branch `feat/kpi-csv-import`, NOT yet merged)

**TL;DR:** P3 (spec section 7) built same-day via subagent-driven development (plan → 10 tasks, each TDD + spec-reviewed + quality-reviewed + review-fixes, then a final whole-branch integration review). Suite 488 → **545 green** (57 new tests), `npm run build` green, both new routes registered. 16 commits on `feat/kpi-csv-import` cut from `main` (`0d2548a..dcc843f`). **Merge to main = the one remaining action** (owner call; trunk policy is direct-to-main suite-green-gated).

**Canonical docs (don't re-litigate):**
- Plan (all tasks done): repo `docs/superpowers/plans/2026-06-11-p3-kpi-csv.md` — includes 10 locked design decisions (fail-loud tiers, window anchoring, result-union-not-throw, server-rendered KPI grid…)
- Spec: vault `10 - PROJECTS/Embalio/specs/2026-06-11-growth-operator-revamp-design.md` §7 + P3 row

**What shipped (this branch):**
- `supabase/migrations/20260612_analytics_daily.sql` — `analytics_daily` table (unique `(profile_id, date)`, RLS-disabled service-role posture like the warehouse). **Applied to live Supabase** (`vzxpakxjnuaesfxihyvl`) via MCP; types hand-reflected.
- `src/lib/kpis/` — `schemas.ts` (`AnalyticsDay` strict intCell — garbage rejects, never coerces to 0; `KpiSummary` zod boundary), `csv.ts` (header-tolerant fail-loud parser: `CsvHeaderError` names missing columns + found headers; bad rows → `rejected[{line,reason,raw}]`; deterministic date regex — NO `Date.parse` on X's informal format), `aggregate.ts` (pure: 7d windows anchored to `dataThrough` not now; averages ÷ days-with-data; band <3% low / 3–8% good / >8% high; follower delta vs snapshot ≤ −7d; epoch-ms snapshot dedupe), `present.ts` (formatRate/PerDay/Delta + exhaustive band-chip map).
- `src/server/kpis.ts` — `importAnalyticsCsv(profileId, csvText)` returns a **result union, never throws** (Next prod masks server-action error messages — the header error IS the feature); 2MB DoS cap; upsert idempotent; `logActivity("csv_imported")`; revalidates `/performance` + `/performance/[card]` + `/`. `getKpis` (throws on read errors, house style) + `getFollowerStat` (45-day snapshot window so the 7d baseline survives CSV lag).
- `/performance` (nav label now **"Stats"**) — server-rendered `KpiGrid` (4 tap-through cards: follow-rate north star w/ band chip, follows/day, visits/day, followers w/ delta; unique sparkline gradient ids) + client `CsvImportCard` (2MB client cap, loud rose/amber banners incl. per-line rejects, `router.refresh()`); existing per-post metrics table kept below.
- `/performance/[card]` — drill-downs (AreaChart + newest-first value table; `Object.hasOwn` guard → 404 on unknown card).
- Home — `FollowerCard` star card (count + 7d delta badge + sparkline; honest empty state) next to CoachCard.

**Dogfood PASSED (same night):** owner imported a full-year CSV (365 rows, 2025-06-12 → 2026-06-11) on prod; `csv_imported` activity logged; cards live. **First readout: follow rate 23.3% (14÷60, small n) · visits 8.6/day · followers 1,298.** The data's verdict: conversion is exceptional, REACH is the bottleneck — every lever should drive profile visits, not profile polish.

**NEXT (in order — P5/P4 deliberately SWAPPED 2026-06-11, owner-approved, based on that readout):**
1. **P5 — Sniper-lite + push** (4–5 days; spec: `watch_targets` + GH-Actions 5-min poll of 5–10 priority handles, vault `targetScore()` productized, unified Telegram + web-push `notify()`, alert latency logged). It's the reach lever the data demands. Open with its own `writing-plans` cycle (P2/P3 loop).
2. Residual P0 leftovers wedged in if small (Engage one-tap Done from phone + nudge/Telegram triggers) — same reach loop.
3. **P4 — Predictions** after (spec row: `src/lib/predict/` — trajectory, what-if, breakout pre-check, weekly forecast; `predictions` table receipts). The year of `analytics_daily` history gives it real fit data whenever it lands.
4. Manual stopgap until P5 ships: daily replies on big in-niche accounts (what the sniper automates) + Sunday CSV re-import (idempotent overwrite).

**Risks/notes:** drill-down ignores the `?profile=` selector (always `profiles[0]` — invisible in single-profile prod; thread searchParams through when multi-profile lands) · home grid shows FollowerCard alone in row 1 if `assignment` is null (only happens on DB failure; P7 polish) · `analytics_daily` is RLS-disabled like the rest of the warehouse (P7 hardening item; Supabase advisor flags 14 such tables) · client `router.refresh()` after import is redundant with revalidatePath but harmless · pre-existing `tsc` error in `src/server/topics.test.ts` (TS2556) predates this branch — vitest runs it fine; fix opportunistically.

---

## 🗒️ SESSION 10 (2026-06-11, evening) — P2 Topic Board SHIPPED end-to-end + phone dogfood PASSED

**TL;DR:** P2 (the #1 pain: stale topics) shipped same-day, subagent-driven: `/topics` mobile board (score 0-100 + why-chips + freshness stamps + dated citations + one-tap Draft this), pure scorer, never-empty freshness chain, and a $0 GH Actions refresh worker running claude CLI on Max-plan OAuth. **Step-zero infra unblock first**: Vercel Hobby prod + `signal-crons.yml` scheduler (warehouse was frozen at 278 rows — now growing). Suite 442 → **488 green**. Phone dogfood passed live: PWA installed → board → Draft this → voiced Gemini draft in sign-off queue (verified in `drafts` table). Note: P0+P1 shipped the same morning (separate session; see vault task docs — that session didn't write a handoff section here).

**Canonical docs (don't re-litigate):**
- Spec: vault `10 - PROJECTS/Embalio/specs/2026-06-11-growth-operator-revamp-design.md` (12 locked decisions)
- P2 plan (all tasks done): repo `docs/superpowers/plans/2026-06-11-p2-topic-board.md`
- Roadmap: vault `10 - PROJECTS/Embalio/_hub/Embalio — Next Steps.md` (P0/P1/P2 marked shipped)

**What shipped (this repo, commits 3534816..9ab6505 — 14 commits on main):**
- `src/lib/topics/` — `schemas` (dated `sources.min(1)` zod-required; sourceless generation auto-retries), `heat.ts` (topic velocity from own `signal_tweets`, 24h vs prior 24h — sanity-checks LLM trend claims), `score.ts` (pure 0-100: niche 35 / heat 30 / cred 20 / timing 15; react/verdict/saturated windows), `board.ts` (full pipeline: warehouse-grounded generation → gateTrend → embed → heat → score → persist `topic_history`; worker-safe, injected Supabase client, NO next/* imports), `dispatch.ts` (workflow_dispatch background refresh, env-gated `GITHUB_DISPATCH_TOKEN` — optional, not yet set), `format.ts` (`formatAgo`, null = don't render).
- `src/server/topics.ts` — `getTopicBoard` 5-state freshness chain (fresh <60min → cached + background dispatch → today's `research_briefings` low-confidence → ≤48h stale banner → labeled empty; phone NEVER triggers live LLM) + `draftFromTopicRow(profileId, topicId)` — IDs only, row re-read server-side (review-driven security fix).
- `src/app/(app)/topics/` + `src/components/topics/` — mobile board UI; nav now Home · **Topics** · Engage · Composer · Reach (`src/components/shell/nav-items.ts`; Brand Voice demoted from primary).
- `src/lib/voice-prompt.ts` — `buildTopicBoardPrompt` (LLM ranks against injected high-velocity warehouse tweets; all scraped fields sanitized + whitespace-collapsed — prompt-injection review fixes).
- `scripts/refresh-topics.ts` + `.github/workflows/refresh-topics.yml` — worker every 3h waking UTC, claude CLI on `CLAUDE_CODE_OAUTH_TOKEN` secret (rides Max plan), Gemini fallback, skips pillarless profiles.
- `.github/workflows/signal-crons.yml` — curls `/api/cron/targeting|tracking` (2h waking) + `/api/cron/follower-snapshot` (daily 00:45Z) with `CRON_SECRET` bearer against prod.
- `src/lib/generate/gemini.ts` — **`gemini-2.5-flash`** (Google shut down `gemini-2.0-flash` 2026-06-01; env-overridable `GEMINI_MODEL`).

**Infra state (all verified live-fire):**
- Vercel: project linked (`ciscos-projects-c3b3be54/embalio`), 13 prod env vars incl. `GEN_BACKEND=gemini` + `GOOGLE_GENERATIVE_AI_API_KEY` (created during dogfood debugging). GitHub-connected: push to main = auto prod deploy.
- GH secrets: `CRON_SECRET`, supabase URL/service key, `OPENAI_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, `GOOGLE_GENERATIVE_AI_API_KEY`; variable `APP_BASE_URL`. **Windows gotcha (cost ~1h): never pipe tokens into `gh secret set` — trailing `\r` breaks API headers; use `--body`. Recorded in Claude memory.**
- CI worker live-fired green: `board written: @fcisco95 → 4 topics` from GitHub runners; scheduled crons self-firing since.
- Warehouse: signal_tweets 278 → 323+ and growing; `topic_history` serving fresh boards.

**NEXT (in order):**
1. **P3 — KPI dashboard + CSV import** (4-5 days; spec section 7): header-tolerant fail-loud CSV import (only source for profile-visits/follows), `getKpis()` aggregator, `/performance` card grid + drill-downs, follower star card on home, follow-conversion north star. Open with its own `writing-plans` cycle.
2. Residual dogfood: Engage one-tap Done from phone + nudge/Telegram triggers (P0 leftovers).
3. Optional polish: `GITHUB_DISPATCH_TOKEN` on Vercel (enables in-app background refresh; scheduled cadence already covers freshness), upgrade actions/checkout+setup-node to Node-24-ready versions before 2026-06-16 (CI deprecation warning).

**Suggested skills next session:** `superpowers:writing-plans` (P3 plan from spec section 7) → `superpowers:subagent-driven-development` (mirror the P2 loop: TDD + spec-review + quality-review per task) → `superpowers:verification-before-completion`. Read this handoff + spec before any code.

**Risks/notes:** topic_history RLS disabled (service-role-only posture, same as research_briefings) — revisit in P7 hardening. `expire→insert` in `board.ts` is non-atomic (next scheduled run self-heals; fine for worker). Stub `@a` profiles in prod DB are skipped by the worker but still pollute `profiles` — consider cleanup. Free-tier Gemini limits: ~10 RPM — fine for single-user dogfood.

---

## 🗒️ SESSION 9 (2026-06-08) — Repositioned to AI growth-operator; Phase 1a (gate + coach) SHIPPED

**TL;DR:** Embalio repositioned from "personal content OS" → **AI growth-operator product** (sellable). Ran the full brainstorm → spec → plan → subagent-driven build loop and shipped **Phase 1a: Credibility Gate + Daily Coach** — the "one gated assignment a day" loop, the brain that wraps the `x-*` skills. 8 commits, 366 tests green, build clean, fast-forwarded onto `feat/recording-cockpit` and pushed.

**Canonical strategy docs (in the cisco-brain vault — READ before continuing; don't re-litigate locked decisions):**
- Spec: `C:\Users\joao_\Documents\cisco-brain\10 - PROJECTS\Embalio\specs\2026-06-08-growth-operator-design.md` — 5 locked decisions: hybrid AI-cost (connect-Claude/BYO + managed-with-caps) · assist-not-automate · one product for everyone · dogfood-then-Stripe · Supabase+Vercel. Core + swappable platform packs (X first).
- Phase 1a plan (done): `…\10 - PROJECTS\Embalio\plans\2026-06-08-credibility-gate-daily-coach.md`
- Research: `…\10 - PROJECTS\Embalio\research\Embalio — Research — 6 Growth-Hacking Product (Superbird teardown + landscape + wedge).md`
- Roadmap: `…\10 - PROJECTS\Embalio\_hub\Embalio — Next Steps.md`

**What shipped (Phase 1a, this repo):**
- `src/lib/credibility/prompt.ts` + `gate.ts` — `gateTrend(pillars, niche, trend)` → `CredibilityVerdict` (fails safe to keep=false). `CredibilityVerdict` schema in `src/lib/schemas.ts`.
- `src/server/credibility.ts` — `gateTrends(profileId, trends)`: keeps only on-niche trends with an angle.
- `src/lib/coach/assignment.ts` — pure `pickAssignment()` (post → reply → rest; one assignment/day; never a 2nd post once posted).
- `src/server/coach.ts` — `getDailyAssignment(profileId)`: reads posts/candidates/`growth_plan`; runs `findHotTopics` + `gateTrends` ONLY when not-posted.
- `src/components/coach-card.tsx` — "your one job today" card, wired as the first card in `src/app/(app)/page.tsx` (reuses the existing `listProfiles()[0]` profile-id resolution).
- Zero schema changes. Reuses `generateStructured`, `findHotTopics`, `GrowthPlan`. Tests follow the Vitest mock-`@/lib/generate`-at-boundary pattern.

**NEXT (in order):**
1. **Task 8 — dogfood.** Run the app, open the dashboard for @FCisco95: confirm POST-with-gated-angle before posting, REPLY after. Tune `src/lib/credibility/prompt.ts` strictness if off.
2. **Phase 1b — retention layer (needs a plan).** ONLY three things: streak (silent freeze + endowed progress + grace) + one loss-framed daily nudge (capped, silent opt-out after ignores) + the **Telegram callback webhook** (the Posted/Skip buttons in `runPulse`/`src/server/pulse.ts` are currently dead — no handler at `src/app/api/telegram/webhook`). Realizes Ideas item #3. Hold the scope line.
3. **Phase 1c — cost.** Wire `src/lib/models.ts` routing (cheap model for the gate) + per-user spend caps (sets up the managed tier).
- Then Phase 2 Stripe (connect-Claude door) → Phase 3 managed tier → Phase 4 LinkedIn → YouTube → TikTok packs.

**Suggested skills next session:** `superpowers:brainstorming` (scope 1b, briefly) → `superpowers:writing-plans` → `superpowers:subagent-driven-development` (TDD + per-task review) → `superpowers:finishing-a-development-branch`. Mirror the Phase-1a loop. Cut Phase-1b as `feat/streak-nudge` off `feat/recording-cockpit`.

**Risks (from the final review):** the morning gate runs ~6 LLM calls per dashboard load — guarded to fire only when not-posted; fine for single-user dogfood, cache later. Gate angle needs a configured profile (pillars + niche). `isToday` uses server-local time. The connect-Claude door (running the loop in a user's Claude plan from the web app) is the least-proven piece — dogfood validates it.

Snapshot: `docs/handoffs/2026-06-08-growth-operator-phase1a.md`.

---

## 🗒️ SESSION 8 (2026-06-05) — Teleprompter BUILT + live revamp to subtitle mode (branch `feat/recording-cockpit`, 45 commits)

**TL;DR:** Executed the full 12-task plan via subagent-driven development, then the owner
smoke-tested LIVE and drove a major UX revamp: the overlay is now a **subtitle** — floating
text only, hover-to-unlock 🔒, main-window control panel, manual-script box with
chunk-per-line + paging. Voice-follow works mechanically end-to-end (CUDA whisper) but is
**registered NOT WORKING** for real use — research brief parked. Full detail:
`docs/handoffs/2026-06-05-teleprompter-subtitle-build.md`.

**What works (owner-verified live):** one-click launch (Electron auto-spawns Next, kills
tree on quit) · subtitle overlay (transparent page, backdrop pill, always-crisp text,
drag, window-resizing width) · lock/unlock via hover-🔒, panel, or Ctrl+I · manual-script
box (Enter = new chunk; sentence/paragraph modes; pages by `lines`, never re-shows seen
text) · control panel in Record Hub (appears when overlay open) · project switcher
dropdown + clickable stage chips (go back to any earlier stage).

**Known issue (parked):** voice-follow — pipeline runs (mic → faster-whisper CUDA →
ws:8765 → follower) but tracking unreliable. Brief + ready-to-run deep-research prompt:
`docs/research/2026-06-05-voice-follow-feasibility-brief.md`. Decision gate documented.
Manual paging is the supported flow.

**Machine setup done (this Windows box):** whisper deps installed into **Python 3.11**
(PATH `python` is 3.8 — too old); launch Electron with
`$env:EMBALIO_PYTHON = "C:\Users\joao_\AppData\Local\Programs\Python\Python311\python.exe"`.
`small.en` model pre-downloaded; CUDA DLLs (pip nvidia-cublas/cudnn) wired via PATH in
`desktop/sidecar/whisper_stream.py`. `.env.local` has `NEXT_PUBLIC_TRANSCRIPT_SOURCE=whisper`
(Electron now auto-picks whisper regardless).

**Specs:** original integration spec (2026-06-04) + `docs/superpowers/specs/2026-06-05-teleprompter-subtitle-mode-design.md`
(supersedes overlay chrome; has "Honest limits"). State: 348 tests pass / 1 skip, tsc + eslint clean.

**▶ DO NEXT:**
1. Finish smoke test: **OBS invisibility** (Display + Window capture must NOT see overlay)
   and **Start session → Stop & export → `.edl` + chapters → import into Resolve**.
2. Then `superpowers:finishing-a-development-branch` — merge/PR `feat/recording-cockpit`
   (45 commits, NOT pushed to origin yet).
3. Later (task #17): run the voice-follow deep-research brief before touching that code.

**Suggested skills next session:** `handoff-memory` (resume) · `superpowers:finishing-a-development-branch` ·
`deep-research` (voice-follow brief, when chosen) · `superpowers:subagent-driven-development` (if new feature work).

---

## 🗒️ SESSION 7 (2026-06-04) — Teleprompter Integration: PLANNING ONLY (branch `feat/recording-cockpit`)

Brainstorming → writing-plans session. **No implementation code written (by request).** Turned the
Odysseus PowerShell teleprompter prototype into an approved design + 12-task plan, and corrected a
stack misconception across the vault.

- **Design spec:** `docs/superpowers/specs/2026-06-04-teleprompter-integration-design.md` (commit `5387dde`)
- **Plan:** `docs/superpowers/plans/2026-06-04-teleprompter-integration.md` (commit `180cf4e`, 12 tasks / 6 slices)
- **Full snapshot:** `docs/handoffs/2026-06-04-teleprompter-integration-planning.md`

**Locked decisions:** Electron (not Tauri) · one-click via an Electron shell that opens the invisible
overlay through IPC (Option A) · consume structured `VideoScript.beats` directly · separate invisible
window (not an OBS browser-source) · presets in local `electron-store` · laptop-safe hotkey defaults.
**Scope:** one-click invisible teleprompter (shipped cockpit foundation + the PS1's chunking /
live-adjust / saved presets / mirror) + a light guided-shoot gate (checklist + 10s audio/framing test).
**Parked:** livestream, OBS-websocket orchestration, batch-shoot, in-app capture, macOS overlay, installer.

**Important correction:** Embalio is **Next.js web + Electron `/desktop` overlay + Python Whisper
sidecar — NOT Tauri.** Five vault docs wrongly said "Tauri/React like Lectus" (a plan never built);
all corrected on 2026-06-04. Recording = **external OBS orchestration**, not native/in-app capture.

**▶ DO NEXT:** build the plan via **subagent-driven-development** on `feat/recording-cockpit`; finish
with the owner-gated Windows smoke test (plan Task 12). The Electron/media glue is designed, not run.

---

## ✅ SESSION 6 (2026-06-04) — Recording Cockpit Overlay (branch `feat/recording-cockpit`)

Built the **invisible same-screen follow-along recording cockpit** — a prompter that
sits on the screen you record but does NOT appear in the recording, plus a beat-by-beat
say/do/fx follow-along, voice-following scroll, and live edit markers.

- **Spec:** `docs/superpowers/specs/2026-06-04-recording-cockpit-overlay-design.md`
- **Plan:** `docs/superpowers/plans/2026-06-04-recording-cockpit-overlay.md` (13 tasks, subagent-driven, TDD)

**What shipped (web app):**
- `ScriptBeat` gained optional `do/fx/ost/brollKeywords/markerLabel`; `buildScriptPrompt`
  now generates them (no DB migration — `script` is jsonb, old beats still parse).
- Pure, fully-tested engines: `src/lib/studio/markers.ts` (Resolve EDL + YouTube chapters),
  `voicefollow.ts` (advance-only fuzzy match), `cockpit-view.ts` (current/next/progress),
  `transcript/` seam (web-speech for browser dev, whisper-sidecar for Electron).
- Cockpit UI: `src/app/overlay/record/[projectId]/page.tsx` + `src/components/studio/cockpit.tsx`
  (SAY/DO/FX + next-peek + progress, voice-following, pedal/keyboard advance, marker export →
  `confirmTake` into Publish). Launchable from Record Hub.

**What shipped (desktop overlay, `/desktop` — its own Electron workspace):**
- `main.js` — transparent, frameless, always-on-top, **`setContentProtection(true)`**
  (WDA_EXCLUDEFROMCAPTURE → invisible to OBS/Zoom/Loom), click-through, global hotkeys.
- Local **Whisper sidecar** (`desktop/sidecar/`) — mic → faster-whisper on the GPU →
  words over `ws://127.0.0.1:8765`. `EMBALIO_VOICE=off` to skip.

**Tests:** 297 pass / 1 skip; `tsc` clean. The web slices are unit-tested; the Electron +
Whisper pieces are syntax-checked only.

**▶ DO NEXT (owner-gated, hardware smoke test on Windows):**
1. `cd desktop && npm install`; `pip install faster-whisper sounddevice numpy` (CUDA).
2. `npm run dev` (with `NEXT_PUBLIC_TRANSCRIPT_SOURCE=whisper` in `.env.local`).
3. Launch the overlay for a record-stage project; **confirm it's invisible in OBS Display +
   Window capture** (the key proof), hotkeys fire while unfocused, voice-following tracks speech.
4. Record a real take → Stop & export → import the `.edl` into DaVinci Resolve.

**Limits:** Windows-only (macOS Sequoia broke capture-exclusion); a phone camera pointed at
the screen still sees the overlay; voice needs the sidecar (browser Web Speech API doesn't
work inside Electron) with pedal/hotkeys as the always-working fallback.

---

## ✅ SESSION 5 (2026-06-02) — YouTube Engine slice 1 (branch `feat/youtube-engine`)

Built the **first thin vertical slice of the YouTube Engine** (a feature of Embalio, not a
standalone product) on branch `feat/youtube-engine` (off `make-it-true`). Brainstorm → spec →
plan → subagent-driven execution (17 tasks, each TDD + reviewed). **253 tests pass / 1 gated
skip; `npm run build` green; `tsc` clean.** New studio files lint clean (the repo's other
pre-existing lint errors are untouched).

- **Spec:** `docs/superpowers/specs/2026-06-02-youtube-engine-thin-slice-design.md`
- **Plan:** `docs/superpowers/plans/2026-06-02-youtube-engine-thin-slice.md`

**What shipped (project-centric pipeline at `/studio`):** a stage rail
`topic → script → record → publish → repurposed` driven by one `video_projects` row.
- **Topic Board** — free Hacker News Algolia signals (`src/lib/studio/signals.ts`) ranked by the
  brain → ~30s human pick gate.
- **Script Studio** — real editable script (title + <15s hook + teleprompter beats ‖ per-line
  visual prompts).
- **Record Hub** — per-device `recording_profiles` (Home/Windows/Rapidemo + Travel/Mac/OBS, seeded)
  drive the teleprompter + beat checklist; active device resolved via a localStorage deviceId map
  (`src/lib/studio/recording-profile.ts`). Orchestrates external OBS (no in-app capture).
- **Publish** — REAL YouTube OAuth + `videos.insert`, **`privacyStatus: "private"` hardcoded**
  (single seam to relax later). File-picker upload via `/api/studio/upload` → `src/lib/youtube.ts`.
- **Repurpose** — `createXThreadFromVideo` reuses the existing `ThreadDraft` schema +
  `saveDraftToQueue`, dropping an X thread into the existing Engage/Compose sign-off queue.
- **Render** — scaffold only (Shotstack deferred to slice 2).

**The "brain" boundary:** `src/lib/studio/brain.ts` exposes a `BrainClient` interface backed in
slice 1 by local `claude -p` (`makeLocalClaudeBrain`). The exported `brain` singleton is the ONLY
line to change when the external Agent-SDK skill chain exists — UI/server untouched.

**▶ DEFERRED / DO NEXT (owner-gated):**
1. **Apply the 3 migrations to the live Supabase project** (`vzxpakxjnuaesfxihyvl`):
   `0009_recording_profiles`, `0010_video_projects`, `0011_youtube_credentials`. They were written +
   hand-reflected into `types.ts` but **NOT applied to the live DB** (intentionally — autonomous run
   never touched prod). Until applied, `/studio` renders its empty state (page wraps reads in
   try/catch). Apply via the Supabase MCP `apply_migration` or `supabase db push`.
2. **Set `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET`** (see env note below) to exercise real publish.
3. Manual end-to-end pass once 1+2 are done; then decide on merge to `make-it-true`.
4. Slice 2 candidates: Shotstack render wiring, Scoreboard/Retro, Opus Clip Shorts.

---

## ✅ SESSION 4 (2026-06-01) — LIVE SMOKE TEST PASSED; Plan B in progress

**Goal A (live end-to-end smoke test) is COMPLETE — the engine works against live data,
with ZERO code changes needed.** What was proven:
- **Apify author-follower field** (`apify.ts:51`): the `??`-fallback guess was **correct** —
  real items use `author.followers` (verified: 888,035 for levelsio). Bonus findings: `text`
  (not `fullText`) is the *complete* tweet body — `fullText` is the misleadingly-named
  *truncated* legacy field, so "switch to fullText" would have **introduced** a bug; and
  `createdAt` (Twitter date string) parses fine for recency. **No `apify.ts` change made.**
- **Apify required a paid plan:** the account was FREE; `apidojo/tweet-scraper` blocks API use
  on free. Owner upgraded to **Starter ($29/mo)** — gate lifted, real data flows.
- **Quiz crafting (3× `claude -p`)**: `synthesizePersona` + `recommendTargets` + `generateGrowthPlan`
  all fire and produce **non-slop, on-thesis** output (anti-slop voiceSpec, ICP targets engineered
  for the 150× reply-back, a real capacity-aware Growth Plan).
- **Live reply-craft engine** (real `/api/cron/targeting` path via a throwaway profile): Apify →
  embeddings → 5–20×/crowding/recency scoring → scenario detection → reply-craft produced
  **genuinely non-slop, scenario-tagged, reply-back-engineered** drafts, and correctly **skipped**
  a low-value banter post. authorFollowers flows correctly (swyx 162k/arvidkahl 199k land in the
  5k-50k band → sizeFit=1).
- **`finalizeSetup` persistence**: validated via a temp route handler in a real request — **every**
  write lands, including the flagged anon-path (`save_persona` RPC + `north_star`/`premium` update).
  The RLS concern is confirmed **future-only**, not a current bug. (The only unverified bit is the
  quiz's client→server-action payload assembly — needs a real browser pass; Playwright MCP was down.)
- **Cleanup**: demo `@naval` candidate+draft deleted; throwaway test profiles deleted; the 10 real
  `seed_targets` preserved. **5 `@a` junk profiles remain** (safety classifier blocked auto-delete;
  owner has a one-liner to run, non-blocking).

**✅ Plan B COMPLETE** (`docs/superpowers/plans/2026-06-01-flows-ui.md`) — Scan→Engage +
Create-a-Post UI shipped via subagent-driven-development (8 tasks, each spec+quality reviewed;
5 needed review-driven fixes, all resolved; final integration review = READY TO MERGE).
13 commits `e553fbb..dde7a23`. **222 pass / 1 skip, build clean.** New surface:
- **Scan→Engage** (primary tab on `/engage`): `src/lib/engagement/present.ts` (fitBadge/freshness),
  `src/server/engage-queue.ts` (getEngageQueue/scanNow; `dismissCandidate` consolidated into
  `posts.ts`, now revalidates board+engage), `src/components/engage-queue-panel.tsx`.
- **Create-a-Post** (tab on `/compose`): `src/lib/engagement/post-craft.ts` (reach-optimized prompt
  + full GOAL_EMPHASIS table), `src/server/create-post.ts` (findHotTopics delegates to
  `generateTrendRadar`; draftPostFromAngle), `src/components/create-post-panel.tsx`.
- **Not pushed** — `make-it-true` is ahead of `origin`; push needs owner say-so.

**✅ LIVE BROWSER VERIFICATION (session 4, via Playwright) — all 3 flows work end-to-end:**
- **`/setup`**: drove the FULL quiz (founder archetype → branching, interstitials, the
  `goalOpen` Next-enable fix confirmed live, optional skips) → crafting screen → **voice-pull
  (Apify @fcisco95, 8s) + 3 `claude -p` calls** (synth+recommend 2.2min, growth plan 42s) →
  Growth Plan reveal (all 7 sections, grounded in fcisco95's real pulled tweets) → curate →
  **`finalizeSetup` persisted everything** (voice_spec 1902 chars, 5 pillars, account_size/
  capacity/reply_playbook, growth_plan jsonb, 14 seed_targets) → redirect to dashboard which
  renders the GrowthPlanCard. **The client→finalizeSetup wiring gap is now CLOSED.**
  ⚠️ **`fcisco95` was intentionally overwritten** with this real /setup run (owner-approved) —
  it is now a properly configured profile (no longer demo data). 10 drafts in the sign-off queue
  (9 engage replies + 1 create-post draft) + scanned candidates on the board.
- **`/engage`**: live scan → 10 cards with fit badges, freshness, all 5 scenario tags,
  non-slop reply-back replies; correctly skipped an emoji-only post.
- **`/compose`**: hot topics → draft → Save to queue (full post persisted).

**🐛 3 real bugs the live run caught + fixed (committed):**
1. `fix(engage)` `f9e5b72` — scan 500'd: OpenAI embeddings rejects empty strings; a text-less
   tweet failed the whole batch. Scan now skips text-less tweets + `embedTexts` is defensive.
2. `fix(generate)` `01c0a60` — Create-a-Post intermittently failed: claude sometimes emits a
   >280-char post (valid JSON, invalid schema) and the retry only said "not valid JSON". Retry
   now feeds back the actual zod error (helps every structured call) + post-craft enforces 280.
3. `fix(create-post)` `3d4aa4d` (during Plan B) — full-thread save, per-action busy labels.

**✅ PUSHED to `origin/make-it-true`** (tip `63cc008`). 225 pass / 1 skip, build clean.

**✅ Follow-ups DONE (session 4, after push):**
- Dashboard "Today's targets" duplicate React key → keyed on `source_tweet_id` (`fix(ui)` `f7b4efc`).
- create-post-panel `Trend` type derived from the server action (no drift) (`f7b4efc`).
- Shared `tabClass` extracted to `src/lib/tab-class.ts` (engage + compose) (`f7b4efc`).
- Test coverage: `interstitialFor` goalOpen branch + `knobsFromProfile` unknown bucket (`63cc008`).

**▶ Still open (non-blocking polish):**
- A controlled/uncontrolled `FieldControl` React warning on some input (Base UI). Minor hygiene —
  not yet located/fixed.
- `getEngageQueue` N+1 (≤11 reads per load) — accepted for V1; a join would be cleaner.
- Dashboard perf (HANDOFF §3): 3 serial DB reads + redundant `profiles` fetch → `Promise.all`;
  parallelize `recommendTargets` + `generateGrowthPlan` on the crafting screen.
- 5 `@a` junk profiles in the DB (owner has a one-liner; safety classifier blocks agent auto-delete).

**▶ NEXT BIG WORKSTREAM (needs plan-first):** spec build-sequence item 7 — **Platform skill
scaffolding** (X active; LinkedIn/YouTube defined-but-inactive, structure-ready for later).
See `docs/superpowers/specs/2026-06-01-engagement-engine-and-quiz-design.md` §4.4.

**Dev gotcha reconfirmed:** `npm run build` while `npm run dev` is up clashes on `.next` and
orphans the dev process (zombie on the port). Stop dev → kill port listener → `rm -rf .next`
→ restart when switching between build and browser testing.

---

## ⏭️ CURRENT DIRECTION (2026-06-01, session 3) — read this first

**Engine + Quiz + Growth Plan are BUILT and MERGED to `make-it-true`** (fast-forward,
tip `736f28b`, local only — **not pushed**). The product reframe (Embalio = a coach whose
value is **engagement quality**: non-slop, scenario-aware replies engineered to make the
author reply back — X weights that ≈150× a like) is now real code. Background/spec in the
snapshot **`docs/handoffs/2026-06-01-engagement-engine-and-quiz-redesign.md`** + spec
`docs/superpowers/specs/2026-06-01-engagement-engine-and-quiz-design.md`.

**What shipped (3 plans, 24 TDD tasks, two-stage reviewed + multi-reviewer pass):**
- **Plan A — Engagement Engine Core** (`docs/superpowers/plans/2026-06-01-engagement-engine-core.md`):
  Apify author-follower capture (`apify.ts`); `knobsFromProfile` (`src/lib/engagement/knobs.ts`);
  size-fit (author 5–20×) + crowding (<20 replies) in `compositeScore` (`scoring.ts`);
  scenario-aware anti-slop reply prompt (`src/lib/engagement/reply-craft.ts`) + `ReplyDraft.scenario`;
  wired into `targeting.ts` (resilient draft loop + batched dedup; persists `engagement_scenario`).
- **Plan C1 — Quiz redesign** (`docs/superpowers/plans/2026-06-01-quiz-redesign.md`):
  chaptered, **archetype-branched** step config + `activeSteps` (`setup-steps.ts`); **the
  `goalOpen` "Next"-disabled bug is FIXED** in a tested pure `stepComplete` (`setup-logic.ts`);
  reflective interstitials; richer persisted answers; rebuilt `setup-quiz.tsx` (chapters,
  branching, interstitials, animated "crafting your growth plan" moment).
- **Plan C2 — Growth Plan artifact** (`docs/superpowers/plans/2026-06-01-growth-plan-artifact.md`):
  `GrowthPlan` zod schema; **dedicated `claude -p` synthesis** (`buildGrowthPlanPrompt` +
  `src/server/growth-plan.ts`); reveal at the quiz climax + dashboard `GrowthPlanCard` + `/plan` page.
- **Plan B (flows UI: Scan→Engage + Create-a-Post) was NOT in scope this session** — still
  written-not-executed at `docs/superpowers/plans/2026-06-01-flows-ui.md`.

**DB:** migrations **0007** (`account_size`/`daily_capacity`/`reply_playbook` + `drafts.engagement_scenario`)
and **0008** (`profiles.growth_plan jsonb`) are **applied live** to the Embalio Supabase
project (`vzxpakxjnuaesfxihyvl`). `types.ts` matches. Tests: **210 pass / 1 skip** (RLS gated); build clean.

**▶ NEXT (in priority order):**
1. ✅ **DONE (session 4)** — Live `/setup` → engine → Growth Plan smoke test passed; Apify field
   verified correct; `finalizeSetup` persistence confirmed; demo `@naval` rows cleaned. See the
   "SESSION 4" block at the top. (Open: 5 `@a` junk profiles; quiz UI→server-action wiring unverified.)
2. ✅ **DONE (session 4)** — Plan B (Scan→Engage + Create-a-Post UI) shipped via
   subagent-driven-development. See the "SESSION 4" block. Next: real browser click-through of the
   two new screens; then push when owner approves.
3. **Tracked follow-ups from the multi-reviewer (deferred, code is correct — these are polish):**
   - *Tests:* `getGrowthPlan` malformed-jsonb→null path; `finalizeSetup` growthPlan-save assertion;
     `knobsFromProfile` unknown-bucket; `answersToInterview` goalOpen-fallback; `interstitialFor` goalOpen branch.
   - *Perf:* dashboard does 3 serial DB reads + a redundant `profiles` fetch (`getGrowthPlan` re-reads the
     row `listProfiles` already loaded) → `Promise.all` or add `growth_plan` to the `listProfiles` select;
     and parallelize `recommendTargets` + `generateGrowthPlan` on the crafting screen (both depend only on `synth`).
   - *Minor:* `ARCHETYPE_LABEL` is duplicated in `setup-logic.ts` (lowercase) vs `growth-plan.ts` (title-case)
     → consolidate into one export; bound `targeting.ts` `console.error(... err)` with `String(err).slice(0,200)`.
4. **Not pushed** — `make-it-true` is ahead of `origin/make-it-true`; push when ready.

---

## TL;DR — Embalio, 2026-05-31

Rebranded **dispatchAI/Resonance → Embalio** (`embalio.com`). Local single-user X
growth engine; generation = `claude -p` on the owner's Claude **Max** plan (free, Opus).

**Apex feature "Pulse" is built + proven live:** scan opportunity → draft comment
(claude) → push to **Telegram** with a **tap-to-copy reply + ✅Posted/⏭️Skip** buttons.
Files: `src/lib/telegram.ts`, `src/server/pulse.ts`, `src/app/api/pulse/route.ts`
(`?refresh=0` = deliver-only). Verified with a seeded ping to the owner's phone.

**Resilience (make-it-solid):** `withRetry` on the claude runner + Apify; research
briefing cache (research once/day); UI error boundaries; targeting split so the
**scan cron is cloud-safe** (claude drafting is local-only); tracking cron → daily.

**Env (`.env.local`, per-machine, gitignored):** ✅ Telegram, ✅ Supabase (Embalio
project, schema live, `FIXED_PROFILE_ID` = fcisco95 profile), ✅ CRON_SECRET.
⏳ Pending for REAL opportunities: `APIFY_TOKEN`, `APIFY_TWEET_SCRAPER_ACTOR`,
`OPENAI_API_KEY`, and `seed_targets` rows. Pulse is demo-seeded until then.

**YouTube OAuth env vars (Task 9, `feat/youtube-engine`):** `YOUTUBE_CLIENT_ID` and
`YOUTUBE_CLIENT_SECRET` — create a Google Cloud OAuth 2.0 Client (Web application) with
YouTube Data API v3 enabled; add redirect URI `http://localhost:3000/api/youtube/oauth/callback`.

**Status:** build green; tests 164 pass / 1 skipped (`rls.test.ts` gated behind
`RUN_RLS_INTEGRATION=1`). Open security item: multi-tenant read-RLS on `profiles`
(the gated test is the canary — user B can still read user A's profile).

**NEW — Onboarding quiz (`feat/onboarding-quiz`, merged 2026-06-01):** quiz-style
first-account setup at **`/setup`** (takeover route outside the `(app)` group, so no
nav chrome; `force-dynamic` so the profile id resolves per-request). One-question-
per-screen, tap-first (chips/toggles/buttons + optional open text), progress bar.
Collects handle, account size, X-Premium, pillars, goal, daily capacity, voice
method. Then the app **synthesizes the voice spec** (`synthesizePersona`) and
**recommends who to follow** (`recommendTargets`, extracted from `generateTargetQueue`);
the user curates toggles → persists `voice_spec` + `seed_targets` via `finalizeSetup`
→ `savePersona`. Voice can be auto-pulled from the user's own posts
(`pullOwnVoiceCorpus`, Apify). Empty accounts are redirected into `/setup` from the
dashboard via `needsSetup(profile)`. Spec: `docs/superpowers/specs/2026-05-31-onboarding-quiz-design.md`;
plan: `docs/superpowers/plans/2026-05-31-onboarding-quiz.md`. No schema migration
(all columns already existed). New files: `src/lib/setup-steps.ts`, `src/lib/setup-logic.ts`,
`src/server/voice-pull.ts`, `src/server/setup.ts`, `src/components/setup-quiz.tsx`,
`src/app/setup/page.tsx`; modified `src/server/target-queue.ts`, `src/app/(app)/page.tsx`.

> **⚠ Tracked follow-ups for the onboarding quiz (don't lose these):**
> 1. **Client-strategy debt:** `finalizeSetup` (`src/server/setup.ts`) updates the
>    profile via `supabaseService` (service-role) but calls `savePersona`, which uses
>    `supabaseServer` (anon/RLS). Harmless in the current local single-user, no-auth
>    setup, and it mirrors a pre-existing repo-wide split — but **when RLS lands the
>    anon-path writes could be denied while the service write succeeds, half-finalizing
>    a profile.** Fix as part of the RLS workstream (unify the client strategy
>    repo-wide); patching just this spot would duplicate `savePersona` logic.
> 2. **Unwired inputs:** `accountSize` and `daily capacity` are collected but not yet
>    wired into recommendation sizing / pulse cadence (deferred in spec §9).
> 3. **Onboarding voice-pull needs `APIFY_TOKEN`** to work; otherwise it falls back to
>    paste/tags. Same key gap as Pulse below.

**Earlier "make it true" workstream (still valid):** dashboard derives every card
from real DB rows with honest empty states; Performance accepts real per-post metrics;
weekly composer + reply queue persist to the sign-off queue.

> **▶ DO THIS NEXT (Pulse tasks #7–10):**
> 1. Make Pulse real — wire Apify + OpenAI + add `seed_targets` (accounts to watch).
> 2. Schedule Pulse via launchd. 3. Wire Posted/Skip callbacks. 4. Pulse dedup
> (don't re-ping the same opportunity) + delete the demo @naval seed row.

**The closed loop now works end-to-end (no fabrication):**
generate (weekly/reply) → Save to queue → pending count → Mark posted →
Performance → enter real numbers → dashboard reach/top-post/strategy fill in.

**Secondary next-session options:**
- **Feed the board's free targets into the dashboard.** "Today's targets" reads
  the `candidates` table, which only the Apify cron fills (can't run locally).
  The free `claude-p` board path (`generateTargetQueue`) doesn't persist yet —
  add a persistence step so the board's results surface on the dashboard.
- **Apify stack** is kept (decision: keep & improve), but is non-functional
  locally — crons need a deployed env. Improving it into a real pipeline is a
  separate workstream.
- Continue the ViewCreator.ai-style cockpit pivot brainstorm:
  `docs/superpowers/notes/2026-05-28-viewcreator-cockpit-brainstorm.md`

### "Make it true" — what changed (branch `make-it-true`)

| Area | Change | Files |
|------|--------|-------|
| Pending count | Was filtering `status='pending'` (never written) → always 0. Now filters real unposted statuses (`draft`/`approved`). | `src/server/posts.ts` |
| Metrics source | New `updatePostMetrics` (zod-validated `posts.metrics`; the single seam the X API swaps into later) + `saveDraftToQueue` + `PostMetrics` schema. | `posts.ts`, `lib/schemas.ts` |
| Performance | Read-only table → inline `MetricsRow` editor (likes/reposts/replies/views → Save). | `performance/page.tsx`, `components/metrics-row.tsx` |
| Dashboard | Dropped fake `REACH/STRATEGY/TOP_POST/TARGETS`. New `getDashboardData()` derives reach, top post, data-only strategy insight, and real candidates; honest empty states. `formatCount` → `lib/format`. | `page.tsx`, `server/dashboard.ts`, `lib/format.ts` |
| New flows persist | Weekly composer + reply queue got "Save to queue" + "Mark posted". | `weekly-composer.tsx`, `reply-queue.tsx` |

Build green; 128 tests pass (1 skipped). The 2 pre-existing failures from the
prior handoff (`buildAlgorithmRulesBlock` stub) are resolved.

---

## 1. What was built this session

### Dispatch design system — full visual parity

Full spec: `docs/superpowers/specs/2026-05-29-dispatch-design-system.md`
Full plan: `docs/superpowers/plans/2026-05-29-dispatch-design-system.md`

**14 commits, outside-in approach:**

| Commit | What |
|--------|------|
| `3be3c86` | Card padding 20px, CardTitle font-semibold |
| `d283836` | Tabs line variant accent underline + brand-text active |
| `afa00bd` | Input/Textarea bg-background + accent focus ring; new: StyledSelect, Skeleton, BrandAvatar, ScorePill/ScoreBar |
| `38f9576` | Cockpit: Card, BrandAvatar, Skeleton loading |
| `aade35d` | Compose: Card, Skeleton loading, StyledSelect, thread connectors |
| `c9a54be` | Engage: Dispatch tab underline, Card cards, StyledSelect |
| `328d02e` | Board: Card, ScorePill/ScoreBar, StyledSelect |
| `0762dbe` | Profiles: overline section titles, Card, BrandAvatar, Input |
| `30c4ac0` | Fix: CardHeader grid, label a11y, remove dynamic rows |
| `c787427` | Charts: Sparkline SVG |
| `0528a76` | Charts: BarChart SVG with hover |
| `bee7f08` | Charts: AreaChart SVG with crosshair + tooltip + ResizeObserver |
| `cb83fef` | Performance: stat chips, AreaChart + BarChart, segmented filter, styled table |
| `eb02439` | Fix: React import in StyledSelect, rel on external link, AreaChart label dedup |

### New files created

```
src/components/ui/select-native.tsx   → StyledSelect
src/components/ui/skeleton.tsx        → Skeleton, SkeletonLine, SkeletonBlock
src/components/ui/brand-avatar.tsx    → BrandAvatar
src/components/ui/score-bar.tsx       → ScorePill, ScoreBar
src/components/charts/sparkline.tsx   → Sparkline (pure RSC, no hooks)
src/components/charts/bar-chart.tsx   → BarChart ("use client", hover state)
src/components/charts/area-chart.tsx  → AreaChart ("use client", ResizeObserver, crosshair)
```

### Known remaining gaps (not in scope of this session)

- `angle-composer.tsx`, `composer.tsx`, `onboarding-wizard.tsx` still use raw
  `<select className="border rounded...">` and raw `border rounded` divs — small
  follow-up to apply StyledSelect/Card there too.
- `buildAlgorithmRulesBlock()` in `src/lib/voice-prompt.ts` is a stub → 1 test failure.
- `src/lib/supabase/rls.test.ts` — 1 pre-existing failure (RLS isolation test), not
  caused by this session.

---

## 2. App architecture (unchanged)

- **Platform:** local Next.js app. Run via `npm run dev`.
- **Generation:** all AI calls go through `generate()` which shells `claude -p`.
  No API keys, no per-token cost. Gemini fallback wired but unused.
- **Voice:** built by onboarding interview → `voice_spec` in Supabase.
- **Human-in-the-loop:** nothing auto-posts; engine drafts, owner copies.
- **X API:** still declined (cost); posting stays AdsPower-only (opt-in, untested).
- **Generation** is local-only (`claude -p`). **Scan + tracking crons are cloud-safe**
  (Apify + OpenAI, no claude) and can deploy to Vercel; the **Pulse** route + claude
  drafting stay local. Stage 2 (product) swaps generation to an API — see NORTH-STAR.

---

## 3. Pending items from prior sessions

- **ViewCreator.ai-style cockpit pivot** (paused 2026-05-28): multi-channel content
  cockpit, no login, one-click tile grid. Brainstorm notes at
  `docs/superpowers/notes/2026-05-28-viewcreator-cockpit-brainstorm.md`.
  Research workflow at `docs/superpowers/workflows/viewcreator-research.workflow.js`.
- **x-growth skills** to wire into `buildAlgorithmRulesBlock()`.
- **3 Codex adversarial findings** from a prior session (referenced in old handoff §4).

---

## 4. How to run

```bash
npm run dev          # start dev server (localhost:3000)
npm run build        # production build — green
npm test             # 146 pass / 1 skipped (RLS integration gated)
```

### Resume on another machine (e.g. Windows)
1. `git fetch origin && git checkout make-it-true && git pull`
2. That machine needs its **own** `.env.local` (gitignored — never synced by git),
   with matching values, and the `claude` CLI logged in (Max plan) for generation.
3. Pulse deliver-only smoke test: `npm run dev`, then GET
   `http://localhost:3000/api/pulse?refresh=0` with header `Authorization: Bearer <CRON_SECRET>`.
