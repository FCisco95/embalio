# Plan — GATE-2 dogfood scorecard + outcome instrumentation

**Date:** 2026-06-26 · **Driver:** make the self-dogfood SCOREABLE before alert #1 fires.
**Status:** approved-to-build · **freeze-safe** (NO P4 predict / P6 strategy touch; their numbers stay OUT).
**Source:** owner brief + verified repo maps (don't re-litigate). Manual-send only; no X-analytics scraper.

## Verified facts (greps + two Explore maps — corrections to the brief)

- **No `skip_reason` / reach / reply-impression instrumentation exists** anywhere. Build-on-top, zero dup.
- **`analytics_daily` has NO out-of-network-reach column** (X CSV doesn't expose it). Columns: `profile_visits,
  new_follows, unfollows, impressions, engagements, likes, replies, reposts, bookmarks, shares`. → the brief's
  "OON reach % from analytics_daily" is **not buildable**. **Substitute the derivable signal that is the
  handoff's actual DoD: reply-day visit-lift** (avg `profile_visits` on acted-reply days vs non-reply days).
  Literal OON% stays a manual read-off for the owner; not stored.
- **`sniper_alerts.status` CHECK = `sent|acted|dismissed`**; dismissals log no activity event → derive
  precision/false-alert straight from `sniper_alerts.status` counts (no activity-kind change).
- **Author median reply-impressions cannot be derived** (X hides reply-source impressions) → manual capture.
- **Reply-outcome can't live on the alert pin** — `getSniperPins` shows only `status='sent'` in a 3h window;
  an acted alert vanishes at action time, but impressions/reply-back are known days later. → outcome capture
  lives on the **scorecard surface** (a list of recent acted alerts with inline inputs). Skip-reason DOES go on
  the pin (decision-time).
- **Do NOT edit `20260622_sniper_manual_send.sql`** (already applied live). New migration file.

## Deliverables

### T1 — migration (additive, nullable) · `supabase/migrations/20260626_sniper_scorecard.sql`
`alter table sniper_alerts add column if not exists`: `skip_reason text` (CHECK null or in
`off_niche,stale,bait,wrong_size,other`), `reply_impressions int`, `author_median_reply_impressions int`,
`author_reply_back boolean`. RLS already disabled (P7 posture). **Write + commit; live-apply left to owner**
(consistent with "push is yours"). Hand-reflect into `src/lib/supabase/types.ts` (Row/Insert/Update).

### T2 — pure scorecard core (TDD) · `src/lib/gate/scorecard.ts` (+ `.test.ts`)
`computeScorecard(alerts, visitDays): GateScorecard`. Metrics, all null-guarded (n=0 → null, never NaN):
- `precision = acted/(acted+dismissed)`; `falseAlertRate = dismissed/(acted+dismissed)`; `skipBreakdown` per reason.
- `authorReplyBackRate` = replyBack-true / acted-with-outcome (+ denominator `authorReplyBackN`).
- `cleared2xCount` = acted with `reply_impressions >= 2*author_median_reply_impressions` (median>0); + `cleared2xN`.
- `replyDayVisitLift = (replyDayAvgVisits − baselineAvgVisits)/baselineAvgVisits`. Reply days = UTC date set of
  acted alerts' `sent_at` (`.slice(0,10)`); baseline = analytics dates not in that set. Empty either side → null.
- `pass`: precision ≥ 0.70, cleared2x ≥ 3, visitLift ≥ 0.25; `overall` = all three met (a null fails its flag).
Deterministic date handling via ISO `slice(0,10)` (no tz math). Pure; no I/O.

### T3 — server reader · `src/server/gate.ts` (+ `.test.ts`)
`getGateScorecard(profileId, {windowDays=45})` — reads `sniper_alerts` (status in acted/dismissed, `created_at >=
cutoff`) + `analytics_daily` (date >= cutoff); calls `computeScorecard`; **throws on DB read error** (mirrors
`getKpis`). Boundary-mocked test (mirror `kpis.test.ts`).

### T4 — server mutations (TDD) · edit `src/server/sniper.ts` + `src/server/sniper-actions.ts`
- `markSniperAlert(profileId, alertId, action, skipReason?)` — on `dismissed`, also write a **validated**
  `skip_reason` (reject values outside the enum). `actOnSniperAlert` wrapper gains `skipReason?`.
- New `setReplyOutcome(profileId, alertId, outcome)` (zod-validated: non-neg ints / bool / null), updates the
  3 outcome cols where `status='acted'`; `revalidatePath("/performance/gate-2")` + `/performance`. Wrapper
  `recordReplyOutcome` in `sniper-actions.ts`. Boundary-mocked tests for both.

### T5 — UI (subagent; exact seams from the map)
- **Skip-reason buttons** on the pin: `src/components/sniper-pins.tsx` Skip (line 94) → 4 one-tap reason
  buttons → `actOnSniperAlert(profileId, alertId, "dismissed", reason)`.
- **GATE-2 card** on `/performance` (`page.tsx`, after KpiGrid) → links to `/performance/gate-2`.
- **`/performance/gate-2/page.tsx`** (static segment wins over `[card]`): read-only scorecard (metrics + pass
  chips) + `<ReplyOutcomeList>` client component — recent acted alerts with `reply_impressions` /
  `author_median` inputs + `author_reply_back` toggle → `recordReplyOutcome`. Mirror `csv-import-card.tsx` /
  `sniper-pins.tsx` action wiring + `coach-card.test.tsx` for a component test.

### T6 — docs
Plan (this) · `docs/HANDOFF.md` Session 18 entry · note the migration must be applied before the live surface works.

## Guardrails (hard)
- Manual-send only — no X API writes (a ban ends the project). Scorecard is read-only; the only interactive bit
  is manual outcome entry. **No ML, no scoring sophistication** — display derived numbers, flag insufficient-n.
- **Freeze fence:** zero touch to `src/lib/predict/*` (P4) or `src/server/strategy*`/P6; keep their numbers out
  of this scorecard. No new activity-event kinds. No read-path change to the warehouse.

## DONE (owner verifies — evidence, not agent report)
- `npx vitest run` green + `npx tsc --noEmit` clean (paste output).
- scorecard computes the metrics from seed/mock rows (tests); live render = owner smoke test post-migration.
- skip-reason buttons write `skip_reason`; outcome list records `reply_impressions`/`author_reply_back`.
- grep-confirmed no dup; freeze-safe. **Commit; push + live-migration left to owner.**
