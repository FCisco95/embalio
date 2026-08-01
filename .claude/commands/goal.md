---
description: Autonomous goal loop — work the Embalio GATE-2 objective ledger to completion without stopping for approval between objectives
---

# /goal — autonomous goal loop

Optional focus override: **$ARGUMENTS** (if set, work only objectives matching it).

You are running **unattended**. Work continuously through the objective ledger in
§4 until a stop condition in §7 fires. **Do not stop to ask for approval between
objectives.** Do not end your turn to report progress and wait — report *and keep
going*. The only permitted pauses are the two forks in §3 and a genuine safety
question.

---

## 1. Mission

> **By 2026-09-04, Embalio must have a computable GATE-2 scorecard proving that
> assisted replies measurably move out-of-network reach — from the owner's daily
> dogfood plus a completed 2-week trial with 3 non-owner users.**

**Deadline ladder** (compute days remaining from today's real date):
`2026-08-10` acted-alert evidence expires · `~2026-08-19` last safe trial start ·
`2026-09-04` gate.

---

## 2. Baseline — measured on prod 2026-08-01, ~23:00 UTC

Re-verify in ORIENT before trusting any line. This is a diff target, not truth.

| DoD leg | Bar | Measured | State |
|---|---|---|---|
| Sniper precision | ≥70% | **3%** (2 acted / 68 decided) | fails — but see O3 |
| Replies clearing 2× author median | ≥3 | **0 of 0** | no outcomes recorded |
| Reply-day visit lift | ≥+25% | **—** | uncomputable, see below |

- `main` @ `85c7689`, clean vs origin, last commit 2026-07-23. Suite **759 pass /
  1 skip**, green.
- **`analytics_daily` is empty — the X analytics CSV has never been imported.**
  Visit lift is mathematically un-earnable until the owner imports it. No code
  fixes this.
- **0 rows with `source='manual'`.** Manual sniper mode shipped 07-23, never used.
- The 2 acted alerts (@KaiXCreator, @SahilPanhotra, both created **2026-06-26**)
  carry NULL outcomes. `src/server/gate.ts:38,64` windows on
  `created_at >= now − 45d`, so **they leave the scorecard on 2026-08-10** and it
  goes blank (acted 0, precision null, reply days 0).
- All 66 dismissals are `skip_reason='stale'` from the Session-20 bulk cleanup —
  they are what drags precision to 3%, and they age out ~2026-08-17.
- **Vercel Deployment Protection is OFF** — an anonymous fetch of
  `/performance/gate-2` returns 200 with real content, including the profile UUID
  in the RSC payload. `src/proxy.ts` is a no-op; `src/server/sniper-actions.ts`
  has zero ownership guards. F2 is live, not latent.
- `/` cold-started in **26.7 s** — on the page the daily-habit card lives on.

---

## 3. The two forks — ask ONCE, batched, then proceed

At the very start, put both to the owner in a single `AskUserQuestion`. **If no
answer arrives, adopt the default below, write it into the log, and keep
working.** Never idle waiting for a reply.

1. **Gate fork** — (a) sprint the dogfood, (b) re-scope what GATE-2 is judged on
   (e.g. drop visit-lift, judge on 2×-clearance + reply-back), (c) move the date.
   *Default: proceed as if (a), since every agent-owned objective below serves
   (a) and (b) equally.*
2. **Trial fork** — build auth + tenancy (F1, multi-day) vs **concierge trial**
   (3 strangers hand over handles, owner drives the app). *Default: concierge —
   there is not enough runway before ~2026-08-19 to build auth and still run two
   weeks.* This default keeps **O6** parked; do not start auth unspecified.

---

## 4. Objective ledger — agent-owned, work top-down

Each objective is done only when its **DoD command** passes. Ship each one
separately; never batch two objectives into one commit.

**O1 — F2 ownership guards.** Add the `src/server/targeting-actions.ts:7`
ownership-check pattern to all four exports in `src/server/sniper-actions.ts`
(`createManualSniperAlert`, `actOnSniperAlert`, `confirmSentReply`,
`recordReplyOutcome`). Anyone on the internet can currently forge acted rows and
outcomes into the dataset the gate is judged on.
*DoD:* new tests prove an unowned `profileId` is rejected; suite + `tsc` + build
green; shipped; prod 200 on `/engage` and `/performance/gate-2`.

**O2 — evidence-expiry safeguard.** The 45-day rolling window silently drops
evidence from view with no warning. Surface, on `/performance/gate-2`, which
acted alerts are within 7 days of leaving the window, and make `windowDays`
overridable so historical evidence stays reviewable.
*DoD:* pure logic unit-tested; card renders the warning against seeded data;
shipped and visible on prod.

**O3 — precision-metric honesty.** 66 bulk-dismissed `stale` rows are counted as
false alerts, so 3% measures a cleanup, not scorer quality. Decide and implement
one of: exclude bulk/stale dismissals from precision, or add a distinct
non-judgement skip reason. Record the decision in a plan doc — this is a
measurement-definition change and must not be silently reversible.
*DoD:* decision doc written; `computeScorecard` tests cover both old and new
behaviour; scorecard reflects it on prod.

**O4 — cold start on `/`.** 26.7 s measured. For a product whose thesis is "open
it every day," this is a habit killer.
*DoD:* before/after numbers from repeated cold+warm fetches; the dominant cost in
`getDailyPlan` / `getTopicBoard` identified and addressed (parallelize, cache, or
move the background topic refresh off the request path); measured improvement
reported honestly, including if it turns out to be Vercel cold start and not our
code — in which case say so and stop, don't gold-plate.

**O5 — manual-loop friction.** Known deferred findings: the manual-submit success
message claims "pinned below" but pins cap at top-5-by-score within 3h (it can
lie); `src/components/coach-card.tsx` is dead code.
*DoD:* message states what actually happens; dead file removed; suite green.

**O6 — PARKED** unless the owner picks auth in §3.2. Under the concierge default,
the equivalent work is multi-profile switching so one owner can drive 3 accounts.
**Write a plan doc and stop — do not implement without sign-off.**

**Out of scope, do not start:** F1/F3–F10, RLS on the 11 open tables,
server-side cap enforcement, P8 adapters, Stripe, P4 predictions, P6 strategy,
YouTube Studio.

---

## 5. Owner queue — surface every cycle, never block on

You cannot do these. Lead every progress report with them, unchecked:

- [ ] **Import the X analytics CSV** on `/performance` (needs `date`,
      `profile_visits`, `new_follows` — `src/lib/kpis/csv.ts`). Unblocks visit
      lift and every KPI card. ~5 minutes.
- [ ] **Record both reply outcomes** on `/performance/gate-2` — worthless after
      **2026-08-10**, when those rows leave the window.
- [ ] **Run the first manual sniper paste** end-to-end on `/engage`.
- [ ] **Turn on Vercel Deployment Protection** (or decide not to, in writing).
- [ ] Answer the §3 forks if still open.

---

## 6. Per-objective loop

```
ORIENT → PLAN → TEST-FIRST → IMPLEMENT → VERIFY → COMMIT → SHIP → PROD-CHECK → LOG → NEXT
```

- **ORIENT** (once per session, batched into few commands): `git status`, suite,
  prod route codes, and the live scorecard numbers. Correct §2 and
  `docs/HANDOFF.md` where they've gone stale.
- **PLAN** — for anything non-trivial write `docs/superpowers/plans/<date>-<slug>.md`
  with the decision and its alternatives, so it is never re-litigated.
- **TEST-FIRST** — red before green. A test that passes before the fix is not a test.
- **VERIFY** — full suite + `tsc` + `npm run build`, all green. **Never leave
  `main` red.** If the suite goes red, fixing it preempts everything.
- **COMMIT** — conventional commits, one objective per commit.
- **SHIP** — direct to `main` (trunk policy). Migrations reach PROD *before* the
  push that reads them.
- **PROD-CHECK** — curl the touched routes; a 200 plus the expected content, not
  just a 200.
- **LOG** — append to `docs/GOAL-LOG.md`: objective, what shipped, commit SHA,
  which DoD number it moved (or **"moved no scorecard number"** — say it plainly),
  and what's next. This file is how the next session resumes.
- **NEXT** — immediately start the next objective. Do not wait.

---

## 7. Stop conditions — the only reasons to end the run

1. Every agent-owned objective in §4 is DONE, and everything remaining is in §5
   or parked. → Write the final handoff (§8) and stop.
2. Three consecutive failed attempts at the same objective. → Park it with a
   written diagnosis, move to the next objective. Only stop if *all* remaining
   objectives are parked.
3. A destructive or irreversible action would be required (data deletion, prod
   DB mutation beyond an additive migration, anything touching X's API write
   path). → Stop and ask.
4. Context is nearly exhausted. → §8, then stop.

Finishing one objective is **not** a stop condition. Neither is "a good place to
check in."

---

## 8. Handoff / continuation protocol

Before stopping for any reason, invoke the `handoff` skill: refresh
`docs/HANDOFF.md`, drop a dated snapshot in `docs/handoffs/`, ensure
`docs/GOAL-LOG.md` is current, and end with the literal line:

> **Resume: open a fresh session in this repo and run `/goal`.**

The next session re-orients from §2 + `docs/GOAL-LOG.md` and continues the ledger.

---

## 9. Standing rules

- **Manual-send only.** Every send opens X's first-party composer. No API write,
  no automated post, ever — an automation ban ends the project.
- **No Apify spend** without an explicit owner budget decision.
- **Verify before asserting.** This repo's handoff has been stale in both
  directions; measure, then state.
- **Report faithfully.** If an objective moved no scorecard number, write that
  sentence. If the gate still can't pass, lead with it.
- **No new dependencies** without stating why nothing in the tree suffices.
- Match surrounding code style; no drive-by refactors outside the objective.

## 10. First action

Run ORIENT, post the §3 forks in one batched question, then **start O1
immediately in the same turn** — do not wait for the answer.
