# Auth merge runbook — `feat/auth-layer` → `main`

**Written:** 2026-09-10 (Session 25) · **Branch under review:** `feat/auth-layer` @ `605ddb3` ·
**Amended branch:** `claude/embalio-macos-handoff-vgt239` (= `main` @ `3c2a606` + the auth
branch + the fixes below). `main` auto-deploys to production.

## Verdict

| Question | Answer |
|---|---|
| Merge `feat/auth-layer` @ `605ddb3` as it stands? | **NO-GO.** It locks the owner out roughly one hour after signing in (session refresh cannot persist, then a redirect loop), and sign-up is open to anyone. Neither is caught by the suite — nothing in it exercises a real session. |
| Merge the amended branch? | **GO, conditional** on steps 0–2 below being done first, in order. Steps 3–4 are the merge and the RLS follow-through. |
| Does the existing profile link to a real auth user? | **Unknown from here — it needs the query in step 0.** The schema in `0001_init.sql` says `user_id` is `NOT NULL` with a foreign key to `auth.users`, but the generated types (`src/lib/supabase/types.ts`, produced from prod) say `user_id: string \| null`, so prod's column has drifted from the migrations. Either way the fix is a one-line `UPDATE`; the failure mode if skipped is exactly the "dashboard looks wiped" one, and the amended branch now refuses to hide it. |
| Vercel Deployment Protection | Still assumed **OFF** (confirmed 2026-09-09; this session could not reach `embalio.vercel.app`, the container's network policy rejects it). Recommendation below: **leave it off** once auth is live, close the two remaining unauthenticated API paths in code instead. |

## What was wrong with the branch (confirmed by reading the installed code, not by a live run)

1. **Session refresh had nowhere to go.** `getUser()` refreshes an expired session
   inside `__loadSession` (`@supabase/auth-js` 2.106, `GoTrueClient.js:2381`), then
   `_saveSession` + the `TOKEN_REFRESHED` event hand the rotated tokens to the cookie
   adapter's `setAll`. In `src/lib/supabase/server.ts` that was a bare
   `cookieStore.set(...)`, and Next 16 throws `Cookies can only be modified in a Server
   Action or Route Handler` from a Server Component (`request-cookies.js:53`). The
   throw propagates out of `getUser()` (it is not an `AuthError`), so `(app)/layout.tsx`
   500s. By then Supabase has already consumed the refresh token, so the browser holds a
   dead cookie.
2. **The proxy decided on cookie presence.** With a dead cookie, `/` → layout → no user
   → `redirect("/login")` → proxy sees the cookie and redirects `/login` → `/` → loop.
   Sign-out lives in the app shell, which never renders. Only clearing cookies by hand
   recovers.
3. **Open sign-up** on a public URL: `signUpAction` had no allow-list.
4. **Silent empty profile.** If the signed-in user owns no profile, `/setup`
   auto-created `handle='new-account'` and the dashboard rendered empty while the real
   row sat unlinked.

What the amended branch does (commit `558a694`): the proxy runs the Supabase client
over request/response cookies, verifies with `getClaims()` and persists refreshed or
cleared cookies (also on redirects); routing decisions are made on the verified result;
the server cookie adapter swallows the Server-Component write; `getSessionUser()` never
throws; `signUpAction` is closed unless the email is on `AUTH_SIGNUP_ALLOWLIST`; and
`/setup` on a `FIXED_PROFILE_ID` deployment shows an "account not linked" notice with
the auth user id instead of creating a profile. Suite 845 pass / 1 skip, tsc + build
green. A structural test now asserts every `src/app/(app)` route is gated — server
actions resolve per page bundle, so an ungated `(app)` route would let its actions run
unauthenticated.

## Step 0 — read-only queries (Supabase dashboard → SQL editor, project `vzxpakxjnuaesfxihyvl`)

```sql
-- Q1. Every profile and the auth user it points at.
select p.id, p.handle, p.user_id, p.created_at,
       u.email, u.created_at as user_created_at, u.last_sign_in_at, u.email_confirmed_at
from public.profiles p
left join auth.users u on u.id = p.user_id
order by p.created_at;

-- Q2. Every auth user. Expect 0 or 1 real one. rls.test.ts creates a_<ts>@test.dev /
--     b_<ts>@test.dev users when RUN_RLS_INTEGRATION=1 — if any exist here they were
--     created against prod at some point; harmless, but do not link to them.
select id, email, created_at, last_sign_in_at, email_confirmed_at
from auth.users order by created_at;

-- Q3. Has profiles.user_id drifted from 0001_init.sql (NOT NULL + FK)?
select column_name, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'user_id';
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.profiles'::regclass and contype = 'f';

-- Q4. Which profile holds the GATE-2 data. Must equal Vercel's FIXED_PROFILE_ID.
select profile_id,
       count(*) filter (where status = 'acted')     as acted,
       count(*) filter (where status = 'dismissed') as dismissed,
       count(*)                                     as total
from public.sniper_alerts group by profile_id;
```

How to read Q1 for the GATE-2 profile (the row whose `id` = `FIXED_PROFILE_ID`):

| Q1 shows | Meaning | Do |
|---|---|---|
| `user_id` set, `email` is yours | Linked. The v0 magic-link era created it. | Sign in with that email. If you don't know the password: Authentication → Users → that user → *Send password recovery* (or set a password there). Skip step 1. |
| `user_id` set, `email` unknown/test | Linked to the wrong account. | Create your user (step 1), then run the `UPDATE` below. **Do not delete the old auth user first** — see the cascade warning. |
| `user_id` NULL | Unlinked. This is the "empty dashboard" case. | Create your user (step 1), then run the `UPDATE` below. |

**Cascade warning.** `0001_init.sql` declares `references auth.users(id) on delete cascade`.
If Q3 shows that FK still exists, deleting the linked auth user in the dashboard
**deletes the profile and everything under it** (alerts, drafts, posts, analytics).
Re-link first, delete never.

## Step 1 — create the owner auth user (pick one)

- **Dashboard (recommended, keeps sign-up closed forever):** Authentication → Users →
  *Add user* → *Create new user* → email + password, **Auto Confirm User = on**. Copy the
  user id.
- **Via the app:** set `AUTH_SIGNUP_ALLOWLIST=<your email>` on Vercel, deploy, use the
  *Create account* card on `/login`, then **unset the variable**. If Supabase Auth has
  *Confirm email* enabled, `signUp` returns no session until the link is clicked and
  `/setup` will bounce you to `/login` — the dashboard route avoids that.

## Step 2 — link the profile, set env

```sql
-- Link the GATE-2 profile to your auth user. Idempotent.
update public.profiles
set user_id = '<AUTH_USER_ID>'
where id = '<FIXED_PROFILE_ID>'
  and (user_id is null or user_id <> '<AUTH_USER_ID>');

-- Verify: exactly one row, your email.
select p.id, p.handle, u.email
from public.profiles p join auth.users u on u.id = p.user_id
where p.id = '<FIXED_PROFILE_ID>';
```

Vercel → Settings → Environment Variables (Production):

| Var | Value |
|---|---|
| `FIXED_PROFILE_ID` | already set; confirm it equals the `profile_id` from Q4 |
| `AUTH_SIGNUP_ALLOWLIST` | **unset** (sign-up closed). Only set it for the bootstrap in step 1. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | already set (main uses `supabaseServer()` today) |

Supabase → Authentication → URL Configuration → Site URL `https://embalio.vercel.app`
(only matters for recovery/confirmation emails).

## Step 3 — merge and verify

```bash
git fetch origin
git checkout main
git merge --ff-only origin/claude/embalio-macos-handoff-vgt239   # base is main@3c2a606, so this fast-forwards
git push origin main
```

Post-deploy checklist (each is a distinct failure the original branch had):

1. Anonymous `GET /` → 307 to `/login`. `GET /login` → 200 with **only** the *Sign in*
   card (no *Create account* card while the allow-list is unset).
2. Sign in → `/` renders the `fcisco95` profile, daily plan card, the same numbers on
   `/performance/gate-2` as before the merge. If you land on an **"account is not
   linked"** page instead, step 2 was skipped — it shows the user id to link.
3. **Wait more than one hour** (Supabase JWT expiry, default 3600 s), then reload `/`.
   You must still be signed in. This is the lifecycle bug; it cannot be tested without
   the wait. (Shortcut: Authentication → Settings → lower *JWT expiry* to 60 s
   temporarily.)
4. *Sign out* in the top bar → `/login`; `/` → 307 again.
5. Crons: dispatch `signal-retention` (`/api/cron/*` is excluded from the proxy matcher)
   and confirm `{ok:true}`. `/api/pulse`, `/api/nudge`, `/api/telegram/poll` pass through
   the proxy untouched (no session cookie → cheap path).
6. Push: re-subscribe on `/engage` once (the subscription is saved as the signed-in user).

Rollback: `git revert -m 1 <merge-sha>` on `main` and push. Only safe **before** step 4 —
see the note there.

## Step 4 — apply the RLS migrations (after 24–48 h of the app running on auth)

Both files on the branch, in this order:

1. `supabase/migrations/20260826_rls_hardening_service_role_tables.sql` — RLS on
   `signal_tweets`, `tweet_metric_snapshots`, `watch_targets`, `sniper_alerts`,
   `push_subscriptions`; anon/authenticated revoked; owner policies re-granted to
   `authenticated` on the last three.
2. `supabase/migrations/20260826_rls_hardening_deferred_profile_tables.sql` — RLS on
   `activity_events`, `analytics_daily`, `follower_snapshots`, `topic_history`,
   `predictions`, `strategy_snapshots`; **no grants back**, service-role only.

Verified on the branch this session: every app read/write of the six service-role-only
tables goes through `supabaseService()` (`kpis.ts`, `predict.ts`, `topics.ts`,
`strategy.ts`, `weekly-activity.ts`, `lib/activity.ts`, the crons), so nothing breaks
when `authenticated` loses access. Both files are idempotent (`drop policy if exists`).

**Why wait:** `main` before this merge reads those tables through `supabaseServer()`
(anon, no session). Once the migrations are applied, a code rollback to the no-auth app
would break `/performance`, `/topics` and the home cards. Apply them only when you are
sure you are not rolling back. Rollback SQL if ever needed:

```sql
alter table public.<t> disable row level security;
grant select, insert, update, delete on table public.<t> to anon, authenticated;
```

## Deployment Protection — recommendation: leave it OFF

With a real session gate, Protection is no longer the thing closing F2 (unauth server
actions) — the proxy is, and the structural test keeps it that way. Turning Vercel
Authentication on for production would also put an HTML login in front of the five
GitHub-Actions cron curls and the Telegram poll (each would need the
`x-vercel-protection-bypass` header), for little gain. What Protection was standing in
for that auth does **not** yet close:

- `/api/studio/upload` (audit F8) and the YouTube OAuth start/callback (F3) are outside
  the protected list on purpose (Studio is frozen; the overlay is opened as a separate
  window/OBS source without cookies). Add `requireSessionUser()` to both when Studio
  unfreezes.
- `/overlay/record/[projectId]` is public today and stays public (read-only, needs no
  cookies as a browser source).

## Side findings (not fixed here; out of scope for the merge)

- **`/api/nudge` and `/api/telegram/poll` are functionally dead on `main` today.**
  `nudge.ts` and `telegram-poll.ts` use `supabaseServer()` from bearer-auth routes that
  carry no session, against tables with `user_id = auth.uid()` policies → zero rows.
  Same class as the `refreshTargets` finding in the goal log. Fix is `supabaseService()`
  in both files (they are cron-context code). Separate commit.
- Lint reports 55 pre-existing errors on `main`; the trunk gate is suite + tsc + build,
  and the files touched by the auth fix lint clean.
