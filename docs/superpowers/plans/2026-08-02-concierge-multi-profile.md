# O6 (parked) — concierge trial: driving 3 stranger accounts without auth

**Date:** 2026-08-02 · **Status:** PLAN ONLY — not implemented, needs sign-off
**Objective:** O6 in `/goal`. The trial fork was answered **concierge**, so this
replaces "build auth + tenancy" (F1), which cannot land and still leave two weeks
of trial before 2026-09-04.

## What the trial actually requires

GATE-2's second half is "a completed 2-week trial with 3 non-owner users."
Under concierge, the strangers never log in. They hand over a handle and a niche;
the owner runs the loop on their behalf and reports back. So the app needs to
hold **four profiles** (owner + 3) and let one operator move between them.

## The good news: most of this already exists

- `profiles` is already the multi-account row (`docs/NORTH-STAR.md` §4), and
  `watch_targets`, `sniper_alerts`, `analytics_daily`, `topic_history` etc. are
  all keyed by `profile_id`.
- `/performance` and `/performance/gate-2` already accept `?profile=<id>` and
  fall back to `profiles[0]`. The scorecard is already computed per profile.
- `listProfiles()` returns every profile **unless `FIXED_PROFILE_ID` is set**,
  in which case it filters to one (`src/server/profiles.ts:24`).

So the concierge build is mostly **removing a single-tenant clamp and adding a
switcher**, not building tenancy.

## The blocking tension — read before starting

**`FIXED_PROFILE_ID` is doing two unrelated jobs.** It scopes what the app shows
*and*, since `e3408a3`, it is the tenant guard on the four sniper server actions
(`ownerMismatch`). Unsetting it to enable multi-profile **silently disables that
guard** — `ownerMismatch` returns false when the env var is empty.

Resolve this first, in one of two ways:

1. **Replace the clamp with an allow-list** — e.g. `OPERATOR_PROFILE_IDS` (comma
   separated). `listProfiles` filters to the set; `ownerMismatch` checks
   membership in the set instead of equality. Keeps a guard, enables 4 profiles.
   **Recommended** — smallest diff, preserves the O1 property.
2. Accept the guard loss and rely on Deployment Protection. Only acceptable if
   protection is confirmed ON, which it currently is not.

## Proposed slices

1. **`OPERATOR_PROFILE_IDS` allow-list** replacing `FIXED_PROFILE_ID` in
   `profiles.ts` and `sniper-actions.ts`, keeping `FIXED_PROFILE_ID` working as
   a single-value fallback so nothing breaks mid-trial. Tests on both.
2. **Profile switcher in the app shell** — a small select that sets `?profile=`,
   persisted per route. `/engage` currently takes no `profile` param and would
   need one (it reads `profiles[0]`).
3. **Per-profile onboarding path** — seed a stranger's `profiles` row (handle,
   niche_description, content_pillars, voice_corpus) plus 4–6 in-band
   `watch_targets`. Today this is hand-written SQL; the trial needs it repeatable
   3×. A `/setup?profile=new` flow or a documented seed script — decide which.
4. **Per-profile analytics import** — `/performance` CSV import must attach to
   the selected profile, not `profiles[0]`. Verify before the trial, since
   visit-lift is per profile.

## What this does NOT solve, and must be said out loud

- **Three strangers' data lands in a publicly-reachable app with no auth.** The
  GDPR LIA (`docs/compliance/2026-06-24-gdpr-lia-signal-warehouse.md`) covers
  warehousing third-party *tweets*; it does not cover operating accounts on
  behalf of named participants. **Confirm Deployment Protection before any
  stranger's data is entered**, and tell participants what is stored.
- Concierge measures *the loop*, not *the product*. Strangers never touch the UI,
  so it produces no usability evidence — only reach evidence. If GATE-2 is meant
  to judge whether the product works for someone other than the owner, note that
  this design deliberately does not test that.
- Owner time scales linearly: 4 accounts × a daily paste loop. That is the real
  constraint, not code.

## Sequencing against the deadline

Slices 1–2 are ~a day. Slices 3–4 are ~a day. That fits before the
**~2026-08-19** last-safe trial start **only if recruitment happens in
parallel** — recruiting 3 participants is the long pole and no code shortens it.
If recruitment has not started by ~2026-08-12, the trial cannot complete before
2026-09-04 and the gate should be re-scoped to the owner dogfood instead.
