# O1 / F2 — guarding the sniper server actions

**Date:** 2026-08-02 · **Status:** decided, implemented · **Objective:** O1 in `/goal`

## The finding that changed the plan

The 2026-07-23 audit recommends fixing F2 by copying the ownership guard at
`src/server/targeting-actions.ts:7` onto the four exports of
`src/server/sniper-actions.ts`. **Verification shows that guard cannot work under
the current architecture, and copying it would break the manual sniper loop.**

That guard reads `profiles` through `supabaseServer()` — the **anon** key plus
cookies — and throws if no row comes back. The `profiles` RLS policy is:

```sql
create policy "own profiles" on profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

The app has **no auth layer**: `src/proxy.ts` is a no-op and there is no sign-in
route, so no session ever exists and `auth.uid()` is always NULL. The read
therefore matches zero rows for *every* caller — attacker and owner alike — and
the guard throws unconditionally.

**Corollary worth its own ticket:** `refreshTargets` (the Refresh button in
`src/components/refresh-button.tsx`) is guarded this way today, so it is
**already broken in production** — every click should throw "Profile not found or
access denied". Logged in the owner queue; not fixed here (out of O1 scope).

## Why no server-action guard closes F2

Two mitigations exist that do not require auth, and neither is sufficient:

1. **`FIXED_PROFILE_ID` mismatch check** (`src/server/profiles.ts:63`) — works
   without a session, but the attacker uses the *correct* profile ID, so it does
   not stop them. The ID is rendered into the **public** RSC payload of
   `/performance/gate-2` (verified by anonymous fetch), so it is not a secret.
2. **Profile-scoping on the mutation** — already present:
   `markSniperAlert` / `setReplyOutcome` / `markSniperReplySent` all filter
   `.eq("profile_id", profileId)`, and `createManualAlert` rejects an unknown
   profile before spending any tokens. Cross-profile writes are already
   impossible.

The actual F2 exploit is not cross-profile — it is that these are **public,
unauthenticated POST endpoints mutating the owner's own rows**. An anonymous
caller can fabricate acted alerts and reply outcomes into the exact dataset
GATE-2 is judged on, and burn OpenAI embedding spend doing it. No guard that
runs *inside* the action can distinguish that caller from the owner, because
there is nothing to distinguish them by.

**Therefore F2 is closed by exactly two things, both outside this objective:**

- **Vercel Deployment Protection** (owner, ~2 minutes) — fronts the whole
  deployment at the edge. This is the correct fix given a single-tenant app, and
  it demotes F1–F6/F8 to latent in one action. **Escalated to the top of the
  owner queue.**
- **F1 — a real auth layer** (out of scope per `/goal` §4).

## What was implemented

A shared `assertOwnedProfile(profileId)` helper applied to all four sniper
actions, enforcing the `FIXED_PROFILE_ID` match that the rest of the repo already
uses (`profiles.ts:63`, `setup.ts`, the cron routes).

This is **defense-in-depth, not the F2 fix**, and the code says so in a comment
so no future reader mistakes it for one. What it does buy:

- Blocks any write aimed at a profile other than the configured tenant, closing
  the arbitrary-`profile_id` insert path through `createManualAlert`.
- Fails closed and consistently with the established repo pattern.
- Gives multi-profile work (O6 / concierge) a single choke point to change,
  rather than four unguarded entry points.

## Alternatives rejected

- **Copy the `targeting-actions.ts` RLS guard** — breaks the owner (see above).
  It is a latent bug, not a pattern to spread.
- **Stop rendering `profileId` into the RSC payload** — raises the attack from
  "ID is printed on the page" to "guess a UUID", which is real hardening, but it
  touches three client components and their prop contracts, and it conflicts
  with the multi-profile switching that concierge (O6) will need. Deferred, and
  worth revisiting only if Deployment Protection is declined.
- **A shared secret in the client** — client code is public; not a control.

## Honest scorecard impact

**Moves no scorecard number.** It protects the integrity of the numbers rather
than improving them. The gate legs remain: precision 3%, cleared-2× 0 of 0,
visit lift uncomputable.
