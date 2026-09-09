# Session 24 — MYCEL growth plan + auth WIP made green

**Date:** 2026-09-09 · **Machine:** Windows · **Resuming on:** MacBook

## TL;DR

Two unrelated workstreams landed this session.

1. **A full X growth plan for `$MYCEL`** (the Solana coin launched on Organic,
   [@organic_mycel](https://x.com/organic_mycel)) — researched, written, and
   published as an artifact. Four tracks, a SOL/day scoreboard, X search
   runbooks, nine engagement archetypes, a FUD protocol, and a contributor
   fee-rail design. Also a paste-ready prompt to build "Campaign Mode" into
   Embalio so the plan is executable in-app.
2. **The uncommitted auth layer that had been sitting in the tree since
   ~2026-08-26 is now green** — it had never actually run. Suite
   **790 pass / 1 skip**, tsc clean, `npm run build` green.

**Nothing about GATE-2 moved.** The 2026-09-04 gate deadline passed on
2026-09-04 with all three DoD legs at their start values (see
`docs/GOAL-LOG.md`). That is unchanged and still needs an owner decision.

## Where things are in git

| Branch | Contains | Prod impact |
|---|---|---|
| `main` | The MYCEL plan docs + this handoff | None — docs only |
| `feat/auth-layer` | F1 auth layer, F6 RLS migrations, test/config fixes | **Would gate prod on merge — see below** |

The auth work was **deliberately not merged to `main`**. `main` auto-deploys to
Vercel production, and merging it would immediately put a login wall in front of
`/`, `/engage`, `/performance` and the rest. That is a real decision, not a
formality — read the risk section before merging.

## 1. MYCEL growth plan

**Artifact (canonical, shareable):**
https://claude.ai/code/artifact/1b49babc-45fc-4a21-bf33-09607af8fc0d

Repo copies (kept in sync, all under `docs/research/`):

- `2026-09-09-mycel-colonization-log.html` — the full plan. Same content as the
  artifact. Open in a browser.
- `2026-09-09-mycel-x-growth-playbook.md` — short internal brief.
- `2026-09-09-mycel-watch-targets.sql` — 37 seed handles for `watch_targets`,
  tiered, 10 active (the hard cap in `src/server/sniper.ts:25`). Re-runnable.
- `2026-09-09-embalio-campaign-mode-prompt.md` — paste-ready build prompt for
  "Campaign Mode" in this repo.

### Verified baseline (live, 2026-09-09)

Market cap $49.8k · liquidity $20.8k · volume 24h $6.8k · 134 trades
(avg ~$51) · **388 token accounts** · pair created ~2026-08-27.

Two corrections that changed the strategy and should not be re-derived:

1. **Helius DAS `getTokenHolders` silently truncates.** It reported 20 holders
   where `getTokenAccounts` returns **388**. Always use `getTokenAccounts` for
   holder counts.
2. **This was never a cold start** — day one did ~$500k volume. It is a launch
   spike that decayed ~99%, with a warm lapsed audience still on-chain.

### The load-bearing strategic claim

**Replies do not buy volume. Replies buy contributors. Contributors buy volume.**
Converting reach to trades at the rates a small account gets would need tens of
thousands of profile visits/day to add a few hundred trades. Track B (X
engagement) is a recruiting funnel; Track C (the fee rail) is the actual engine.

### Owner decisions still open

- **The lock address.** 10% of supply is locked for two years but unpublished,
  and there is no public address/tx yet. A lock nobody can verify is worth
  nothing. Also: confirm whether it is 10% of *total supply* or 10% of the
  *founder allocation* — those are different public claims and the plan says to
  publish the smaller true one.
- **The treasury wallet does not exist and nothing has routed.** Until both are
  real and public, the fee-rail claim is an intention and the plan says to
  describe it that way.
- **Public repo.** This repo has been public since 2026-06-11, so everything in
  `docs/research/` is world-readable on GitHub. This was flagged twice; the
  instruction was to push everything. Revisit if that was not intended — the fix
  is `git rm --cached` plus a `.gitignore` entry, but the content will remain in
  history.

## 2. Auth layer (branch `feat/auth-layer`)

### What was already in the tree (not written this session)

`src/server/auth.ts`, `auth-actions.ts`, `fixed-profile.ts`, `src/app/login/`,
`src/components/login-form.tsx`, a real session gate in `src/proxy.ts`, and two
RLS-hardening migrations dated `20260826`. Roughly 20 server modules were
migrated from `supabaseService` to `supabaseServer` + ownership guards.

### What this session did to it

**It had never run.** `src/server/auth.ts` imports `server-only`, which was
never installed — so the suite failed at import.

1. `npm install server-only` (now in `package.json`).
2. Added `src/test-stubs/server-only.ts` and aliased `server-only` to it in
   `vitest.config.ts`. Vitest runs in plain Node with no RSC condition, so the
   real package throws on import. The build-time guard is unaffected.
3. Repaired `src/server/setup.test.ts`, which still mocked `supabaseService`
   after `setup.ts` moved to `supabaseServer` + `assertOwnProfile`. Added a test
   that `finalizeSetup` refuses to write to a profile the session user does not
   own.

Result: **790 pass / 1 skip**, `tsc --noEmit` clean, `npm run build` green
(`/login` route and `Proxy (Middleware)` both present in the build output).

### ⚠️ Read before merging to `main`

`main` auto-deploys to Vercel production. Merging puts a login wall in front of
the app. Two specific risks, **neither verified** — a Supabase query to check
them was started and interrupted, so this is the first thing to settle next
session:

1. **Possible empty-dashboard-on-login.** If the existing profile (the one
   holding all the GATE-2 data) has a `NULL` or unmatched `user_id`, then after
   signing up you get a *new* profile and the dashboard will look empty. The
   data would not be lost, just unlinked.
   **Check:** `select id, handle, user_id from profiles;` on prod
   (`vzxpakxjnuaesfxihyvl`), then confirm a matching `auth.users` row exists.
2. **Sign-up is open to anyone.** `signUpAction` in `src/server/auth-actions.ts`
   has no allow-list, and Vercel Deployment Protection is confirmed **OFF**. On
   deploy, any stranger can create an account and their own tenant.
   Net security is still *better* than today (today every server action is an
   unauthenticated service-role RPC — see `docs/security/2026-07-23-audit.md`),
   but an open sign-up form on a public URL is a new exposure.

**Suggested merge sequence:** verify the `user_id` link → turn on Deployment
Protection → add an allow-list or disable public sign-up → merge → re-verify
prod → then apply the two `20260826` RLS migrations by hand.

## What to do next

1. **Settle the profile/`user_id` question** (query above). It gates everything
   about the auth branch.
2. **Decide the auth merge** using the sequence above, or explicitly park the
   branch.
3. **MYCEL week one** — the plan's own ordered checklist. The two that change
   the trajectory: create + publish the treasury wallet, and route the first fee
   payment to a real contributor and post the tx.
4. **GATE-2 is past its deadline.** Re-scope it or close it out; `docs/GOAL-LOG.md`
   holds the ledger and the owner queue.
5. **Optionally start Campaign Mode** with
   `docs/research/2026-09-09-embalio-campaign-mode-prompt.md`. Its own advice is
   to ship slice 1 first (campaign row + daily on-chain snapshot + ladder view),
   because a live SOL/day number is the only thing that makes the rest worth
   opening.

## Suggested skills

- **`handoff-memory`** — reconstruct context on the MacBook at session start.
- **`/goal`** — resume the GATE-2 objective ledger, if that is the chosen focus.
- **`superpowers:systematic-debugging`** — if the auth branch misbehaves against
  the live Supabase project.
- **`supabase-security`** — before merging auth and applying the RLS migrations.
- **`multi-reviewer-patterns`** — the auth layer touches ~20 server modules and
  is exactly the kind of change the repo's own convention says to review in
  parallel before merging.

## Unverified claims in this document

- Day-one volume (~$500k), the ~1% fee rate, the ~10 SOL treasury and the 10%
  supply lock are **operator-supplied approximations**. They reconcile with each
  other and with the on-chain volume history, but none are independently
  verified.
- The seed handles in the `watch_targets` SQL were **not** checked for liveness —
  x.com returns HTTP 402 to automated fetches. Verify each before use.
- The two prod risks in the auth section are **unverified**; the check was
  interrupted.

---

## Starter prompt for the next session

Run `claude --model claude-fable-5-1`, then `/effort medium` (the routing table
in the global `CLAUDE.md` caps Fable at medium for cost; that table still lists
Fable 5 rather than 5.1 and is worth updating). Paste:

```
Picking up Embalio on a different machine (was on Windows, now MacBook).
Read docs/HANDOFF.md first — the Session 24 entry at the top is where I left off.
Full detail: docs/handoffs/2026-09-09-session24-mycel-growth-plan-and-auth-wip.md

State: main @ 273919a (docs only), feat/auth-layer @ 605ddb3 (auth + RLS, NOT
merged). Working tree was clean. Suite 790 pass / 1 skip, tsc + build green on
the branch.

Work these in order. Stop and tell me if any of them turns out to rest on a
wrong assumption — two corrections last session came from exactly that.

1. UNBLOCK THE AUTH MERGE. This gates everything else.
   The question: does the existing profile (the one holding the GATE-2 data)
   link to a real Supabase auth user? If not, merging feat/auth-layer means I
   log in and get a NEW empty profile, and the dashboard looks wiped.
   Check on prod (vzxpakxjnuaesfxihyvl):
     select id, handle, user_id from profiles;
   then confirm a matching row in auth.users.
   Ask me before running it via the Supabase MCP — I may run it myself in the
   dashboard.
   Then give me a go/no-go on merging, covering: the user_id link, that
   signUpAction has no allow-list, and that Vercel Deployment Protection is
   still OFF. main auto-deploys to production, so this is a real decision.

2. GATE-2 IS PAST ITS DEADLINE (2026-09-04, no leg moved).
   Read docs/GOAL-LOG.md. I want a recommendation, not a summary: re-scope it,
   close it out, or replace it with the MYCEL campaign as the real dogfood.
   Argue the case — including the case against whichever you pick.

3. MYCEL WEEK ONE.
   The plan is docs/research/2026-09-09-mycel-colonization-log.html (open it in
   a browser; the artifact is the same content). The two items that change the
   trajectory are creating + publishing the treasury wallet, and routing the
   first fee payment to a real contributor and posting the tx. Both are mine to
   do, not yours — but tell me what you need from me to make them verifiable,
   and draft the posts.
   Still unresolved: the supply-lock address, and whether "10%" is of total
   supply or of my allocation. Those go public, so they have to be exactly right.

4. OPTIONAL, ONLY IF 1-3 ARE SETTLED: start Campaign Mode.
   Prompt is docs/research/2026-09-09-embalio-campaign-mode-prompt.md. Plan
   before building and get my sign-off on the slice order. Slice 1 is the
   campaign row + daily on-chain snapshot + ladder view — a live SOL/day number
   is the only thing that makes the rest worth opening.

Constraints:
- AGENTS.md: this Next.js is not the one you remember. Read the guide in
  node_modules/next/dist/docs/ before writing any code.
- Trunk policy is direct-to-main and suite-green-gated. Keep 790 green, tsc and
  next build green.
- Write migrations, don't apply them to prod — hand me the SQL.
- This repo is PUBLIC. Anything in docs/ is world-readable.
- Helius: use getTokenAccounts for holder counts, never getTokenHolders (it
  truncates — it reported 20 where the real number is 388).
```
