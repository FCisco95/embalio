# O3 — what "sniper precision" counts

**Date:** 2026-08-02 · **Status:** decided, implemented (migration NOT applied)
**Objective:** O3 in `/goal` · **This changes a GATE-2 success metric — read before altering.**

## Problem

`/performance/gate-2` reports **precision 3%** (2 acted / 66–67 dismissed).
Precision is `acted / (acted + dismissed)` (`src/lib/gate/scorecard.ts:99`).

Every one of those dismissals carries `skip_reason='stale'` and comes from a
single **bulk cleanup on 2026-07-22** (Session 20), when 67 alerts that had sat
at `status='sent'` for weeks were marked dismissed in one operation. **None was
individually judged.**

So the headline number does not measure what its name claims. It measures a
housekeeping action. Anyone reading the gate — the owner in September, or a
stranger evaluating whether this product works — reads "3%" as "the scorer is
almost always wrong." That is not what happened.

## Decision

**Introduce a distinct skip reason, `not_reviewed`, meaning "never judged", and
exclude it from both the precision and false-alert denominators.**

Rejected alternative: **exclude `stale` from precision**. `stale` is a real
judgement with real meaning — "I saw this and the tweet had aged out before I
could reply" is a genuine sniper failure (a latency problem), and it should keep
counting against precision. Collapsing it would hide a true weakness. The defect
is that one bulk action *borrowed* a judgement label for a non-judgement.

Precision therefore becomes `acted / (acted + judged dismissals)`, and
un-reviewed alerts are reported separately as their own count rather than
silently inflating the failure rate.

## Deliberately NOT done: backfilling the 67 existing rows

Re-labelling the existing bulk-dismissed rows to `not_reviewed` would be a
mutation of 67 production rows. That is the owner's call, not an autonomous
agent's, and it is **not necessary**: those rows were created 2026-06-26 →
07-03, so the rolling 45-day window drops them between **2026-08-10 and
2026-08-17** on its own. After that precision reflects only freshly judged
alerts.

**Consequence to state plainly: the precision figure is not meaningful before
~2026-08-17, whatever this change does.** The fix is forward-looking — it stops
the next bulk cleanup from repeating the distortion.

## Migration status — read this before the next bulk cleanup

`supabase/migrations/20260802_skip_reason_not_reviewed.sql` adds `not_reviewed`
to the CHECK constraint on `sniper_alerts.skip_reason`. It is **written and
committed but NOT applied to PROD** — this session has no DB credentials (same
situation as Session 21's `source` column).

This is safe to ship unapplied because **no runtime path writes the new value**:
the four skip-reason buttons on the alert pin are unchanged, and only the read
side understands it. Apply the migration before any future bulk cleanup uses
`not_reviewed`, or the write will be rejected by the constraint.

## Honest scorecard impact

**Moves no scorecard number today.** With no rows labelled `not_reviewed`,
precision stays 3% until the bulk rows age out. What changes is that the number
can no longer be quietly wrong in the same way again, and the card now shows the
judged denominator instead of implying all 67 were evaluated.
