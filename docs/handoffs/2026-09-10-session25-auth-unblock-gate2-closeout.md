# Session 25 — auth merge unblocked (with two bugs fixed), GATE-2 close-out recommendation, MYCEL week-one drafts, Campaign Mode plan

**Date:** 2026-09-09/10 · **Machine:** MacBook (Claude Code on the web, remote container) ·
**Branch:** `claude/embalio-macos-handoff-vgt239` (= `main` @ `3c2a606` + `feat/auth-layer` @ `605ddb3`
+ this session's commits) · **Suite:** 845 pass / 1 skip · tsc clean · `next build` green.

## TL;DR

1. **The auth branch would have locked you out.** Not a guess — traced through the installed
   `@supabase/ssr` 0.10 / auth-js 2.106 / Next 16 code. About an hour after signing in, the
   access token expires, `getUser()` refreshes it inside a Server Component, Next throws on
   the cookie write, the refresh token is already consumed, and the proxy (deciding on cookie
   *presence*) then bounces `/login` → `/` → `/login` forever. Plus open sign-up, plus a
   silent empty profile if `user_id` is unlinked. **All four fixed** in `558a694`, with 46
   tests including a structural one that every `(app)` route is gated. The verdict, the
   prod SQL to run, the order of operations and the rollback are in
   **`docs/runbooks/2026-09-10-auth-merge-runbook.md`**.
2. **Whether the GATE-2 profile links to an auth user is still unknown** — the container
   cannot reach Supabase, Vercel, Solana RPC or DexScreener (network policy), and no Supabase
   MCP is attached to this session. Two facts narrow it: `0001_init.sql` says `user_id NOT
   NULL` + FK to `auth.users`, but the prod-generated types say nullable, so the column has
   drifted. Either way it is a one-line `UPDATE` (runbook step 2), and the amended branch now
   refuses to hide the unlinked case.
3. **GATE-2: recommendation is close it as NOT RUN and open GATE-3 on MYCEL with two
   ring-fenced legs** (campaign: SOL/day ≥ 1.5 or ≥ 10 contributors by 2026-10-09; product:
   ≥ 40 manual-sniper replies with outcomes across ≥ 2 operators) and a **2026-09-24
   tripwire** (< 20 manual rows → stop building measurement). The argument, including the
   case against, is the last entry in **`docs/GOAL-LOG.md`**. Owner decision needed.
4. **MYCEL week one:** what I need from you for the treasury, the first payout and the lock
   to be verifiable by a stranger, and nine post drafts with placeholders —
   **`docs/research/2026-09-10-mycel-week-one-posts.md`**. The lock is the one that can go
   wrong: if the 100M sits in a wallet rather than a locker program, it is a promise, not a
   lock, and the draft says so.
5. **Campaign Mode:** slice plan for sign-off, not built —
   **`docs/superpowers/plans/2026-09-10-campaign-mode-slices.md`**. Order 1 → 2 → 3 → 4 → 5,
   `campaign_id` on `sniper_alerts` as the GATE-2 separation, operators as labels for v1.

## What this branch contains

| Commit | What |
|---|---|
| `a491511` | Merge of `origin/feat/auth-layer` into `main` (no conflicts; docs vs code) |
| `558a694` | The auth fixes: proxy session refresh + verified routing, cookie-adapter guard, fail-soft `getSessionUser`, `AUTH_SIGNUP_ALLOWLIST`, `/setup` unlinked-account notice, `.env.example` |
| (docs commit) | Runbook, GOAL-LOG entry, week-one posts, Campaign Mode slice plan, this handoff |

`git merge --ff-only origin/claude/embalio-macos-handoff-vgt239` onto `main` fast-forwards.
**Merging deploys the login wall** — do runbook steps 0–2 first. If you decide NO-GO on auth,
cherry-pick the docs commit alone; nothing in it depends on the code.

## Findings that overturned assumptions (do not re-derive)

1. **"Green suite" ≠ "auth works".** Nothing in the suite exercised a session lifecycle.
   The bug is only reachable by waiting past JWT expiry — runbook step 3.3 says how to test
   it in a minute by lowering *JWT expiry* in Supabase.
2. **Server actions are per-page-bundle** (`next/dist/server/app-render/manifests-singleton.js`
   resolves `workers[page]`), so the proxy's protected-path list *does* gate them — but only
   if every `(app)` route is listed. It was; the new structural test keeps it so.
3. **Deployment Protection: recommend leaving it OFF** once auth is live. On Hobby it would
   also front the five cron curls and the Telegram poll; the auth layer closes what it was
   standing in for. Remaining unauthenticated paths (`/api/studio/upload`, YouTube OAuth) are
   Studio-frozen and listed as code follow-ups.
4. **`/api/nudge` and `/api/telegram/poll` are dead on `main` today** — `supabaseServer()`
   with no session under RLS → zero rows. Pre-existing, same class as `refreshTargets`. Not
   fixed (out of scope); 2-line fix each.
5. **GATE-2's window has emptied.** The 06-26 alerts and the bulk dismissals aged out between
   08-10 and 08-17; the default scorecard is now null across the board. Re-scoping the date
   alone changes nothing.

## Unverified in this session (network-blocked)

- Prod's `profiles.user_id` value and the `auth.users` row — **runbook Q1–Q4**.
- Deployment Protection state (carried forward as OFF from 2026-09-09).
- MYCEL baseline numbers (carried from 2026-09-09) and whether a ~100M token account exists
  (`getTokenLargestAccounts` on the mint answers it in one call).
- The `great-web-copy` and `promptfoo` skills named in `AGENTS.md` were not available in this
  session's skill list; the drafts follow their rules by hand (no buzzwords, hook + reply-1).

## Next session

1. Run runbook step 0 in the Supabase SQL editor; paste the four results.
2. Decide GATE-2 (a/b/c/hybrid) — `docs/GOAL-LOG.md` last entry.
3. Decide the Campaign Mode slice order — the four sign-off items at the bottom of the plan.
4. If auth is GO: steps 1–3 of the runbook, then `git merge --ff-only`, then the post-deploy
   checklist, then (after a day or two) step 4.
5. Week one of MYCEL is yours; the drafts wait on `[[TREASURY]]`, `[[TX_PAYOUT_1]]`,
   `[[LOCK_ACCOUNT]]`.
