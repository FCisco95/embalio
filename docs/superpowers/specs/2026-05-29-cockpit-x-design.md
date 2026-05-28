# Spec — Sub-project 1: No-login Cockpit + X channel end-to-end

**Date:** 2026-05-29
**Status:** Draft for review (written during the autonomous long-run; review before/after the plan).
**Part of:** dispatchAI → ViewCreator-style multi-channel content cockpit pivot.
**Informed by:** `docs/superpowers/notes/2026-05-28-viewcreator-brief.md`,
`docs/superpowers/notes/2026-05-28-viewcreator-cockpit-brainstorm.md` (locked decisions).

---

## 1. Goal & non-goals

**Goal.** Turn dispatchAI into a frictionless personal cockpit: open `localhost:3000`, no login,
land on a one-click tile grid, and run the existing voice-consistent brain (research, posts,
replies, who-to-follow, thread, voice) for the **X channel** end-to-end — including a real
(but dry-run-by-default) publish path. Establish the channel/tile/publish patterns SP2–SP7 reuse.

**Non-goals (explicitly deferred to later sub-projects).**
- No other channels' generators or publishing (SP4/SP5).
- No live posting enabled by default, no paid APIs, no money spent (guardrail).
- No model router (SP3), no trends APIs (SP2), no scheduler (SP6), no MCP server (SP7).
- No multi-user / multi-profile. Single fixed profile only.

**Success criteria.**
1. `npm run dev` → `localhost:3000` shows the tile grid with **zero auth**; no redirect to `/login`.
2. Each tile runs its existing action and renders results, using the fixed profile's `voice_spec`.
3. Research runs once and is **cached for the day**; posts/replies/who-to-follow reuse the cache.
4. The X publish path is callable through a single `publish()` interface, **defaults to dry-run**,
   and the two known `posting.ts` correctness bugs are fixed.
5. `npm test` green and `npx tsc --noEmit` clean. No live post is ever sent during this work.

---

## 2. Architecture

Three concerns, each independently testable:

### 2a. Trusted-local data access (replaces auth)
- **Remove** `src/middleware.ts` auth redirect, `src/app/login/`, `src/app/auth/callback/`.
  (Keep DB RLS policies in place — harmless; we simply stop relying on per-user sessions in-app.)
- **New** `src/lib/active-profile.ts`:
  - `db()` → returns the **service-role** Supabase client (wraps existing `supabaseService()`),
    the single server-side DB handle for all app reads/writes.
  - `getActiveProfile()` → resolves the one fixed profile. Resolution order:
    `process.env.ACTIVE_PROFILE_ID` → else the first profile row with a non-null `voice_spec`
    → else the first profile. Returns `{id, handle, voice_spec, content_pillars}`. Throws a clear
    error if no profile exists (with a hint to run onboarding).
- **Refactor** every server action that currently calls `supabaseServer()` + a `profileId` arg
  (`original.ts`, `engage.ts`, `persona.ts`, `posting.ts`, `profiles.ts`, board query) to use
  `db()` + `getActiveProfile()`. `profileId` params keep working but default to the active profile.
- **Env:** document `SUPABASE_SERVICE_ROLE_KEY` (local Supabase secret) and optional
  `ACTIVE_PROFILE_ID` in `.env.local`. Fail loudly with a readable message if the service key is missing.

### 2b. Shared cached weekly briefing
- **New migration** `0005_research_briefings.sql`: table `research_briefings`
  (`id uuid pk`, `profile_id uuid fk`, `day date`, `payload jsonb`, `created_at timestamptz default now()`),
  unique on `(profile_id, day)`. `payload` holds `{ xTopics, github, news, angles }` (the synthesis output).
- **New** `src/server/briefing.ts`:
  - `getWeeklyBriefing(profileId?, { forceRefresh = false })` → if a row exists for
    `(profile, today)` and not `forceRefresh`, return cached; else run the 3 parallel research
    calls + cross-ref synthesis (lifted out of `generateWeeklyPosts`), upsert, return.
  - Returns `{ briefing, cached: boolean, researchedAt }`.
- **Refactor** `generateWeeklyPosts` to call `getWeeklyBriefing()` for Steps 2–3 instead of
  inlining research, then draft from `briefing.angles`. `generateReplyQueue` and the new
  who-to-follow action also read the cached briefing for context. Net effect: one ~2-min run/day
  feeds every tile; the rest are fast.

### 2c. Channel + publish abstraction (X as reference)
- **New** `src/lib/channels.ts`: a `Channel` descriptor (`key: "x"`, `label`, `tiles: TileDef[]`).
  SP1 registers only `x`. SP4 adds more by appending descriptors — no UI rewrite.
- **New** `src/lib/publish/index.ts`: `publish(channel, draft, { dryRun = true })` → looks up the
  channel's adapter. X adapter wraps the existing `posting.ts` / `adspower.ts` path. `dryRun: true`
  (the default) validates + logs + records intent **without sending**. Live send requires explicit
  `dryRun: false` AND `NEXT_PUBLIC_POSTING_ENABLED === "true"` AND an env opt-in flag.
- **Fix the two `posting.ts` bugs (handoff §5) as part of this — they are the reference adapter:**
  1. Check `.error` on each of the three post-confirmation writes; only return `{ok:true}` when all
     succeed (or wrap in a transactional RPC).
  2. Add an intermediate non-retryable `needs_manual_confirmation` state for ambiguous outcomes
     (migration: `posting_jobs.status` check-constraint + a `drafts` `unconfirmed` status) so a retry
     can't double-post live.

---

## 3. UI

- **`/` (new home):** the tile grid. Tiles (each → a focused view):
  🔍 Research the week · ✍️ Generate posts · 💬 Who to reply to · ➕ Who to follow (NEW) ·
  🧵 Draft a thread · 🎙️ Tune my voice. Each tile shows a one-line description and, where relevant,
  a "researched Xh ago · re-run" affordance backed by the briefing cache.
- **Reskin existing pages** as the tile targets: `/compose` (WeeklyComposer, now briefing-backed),
  `/engage` (ReplyQueue), profile/voice editor. **Remove the profile-switcher** (single profile);
  nav drops to the tiles + a small "voice" link.
- **New** `/follow` page + `who-to-follow` panel: list of proposed accounts with handle, why-follow,
  and a suggested first interaction; Copy buttons. No follow API — copy-out only.
- **Thread tile:** uses existing multi-post drafting (`OriginalDraft` supports up to 7 posts).
- Progress + error states everywhere a `claude -p` call runs (they take 30–120s); failures toast,
  never silently blank.

---

## 4. New server logic: who-to-follow

`src/server/follow.ts` → `proposeAccountsToFollow(profileId?)`:
- Inputs: active profile (voice_spec, pillars), cached briefing, existing `seed_targets`.
- One `claude -p --allowedTools WebSearch WebFetch` call → structured list
  `{ accounts: [{ handle, why, suggestedAngle }] }` (new Zod schema `FollowSuggestionList`,
  validated via existing `generateStructured`). Dedup against accounts already in `seed_targets`.
- Free; no follow action is taken — output is review-and-copy.

---

## 5. Error handling
- Missing service-role key or no profile → readable startup/action error, not a stack trace.
- Briefing research failure → surface partial + allow re-run; never cache a failed payload.
- Publish: dry-run is the default and the only path exercised in this sub-project; the bug-fixes
  above guarantee no false-success and no duplicate-live-post on retry.
- All generation failures toast in the UI and return a typed error from the action.

---

## 6. Testing
- **Unit:** `getActiveProfile()` resolution order; `getWeeklyBriefing()` cache hit/miss + no-cache-on-failure;
  `publish()` dry-run records intent without sending; `FollowSuggestionList` parse; `posting.ts`
  bug-fixes (failed-write → `{ok:false}`; ambiguous → `needs_manual_confirmation`).
- **Integration:** existing `rls.test.ts` still passes (RLS policies unchanged at DB level).
- **Gates:** `npm test` green + `npx tsc --noEmit` clean after every task; `next build` succeeds at the end.
- **Manual (headless, NOT via Playwright-in-dev — see flicker note):** boot stack, hit `/`,
  run Research once then confirm a second tile uses cache.

---

## 7. Risks / open questions (resolved or flagged)
- **Service-role local-only:** bypassing RLS in-app is safe locally but unsafe if ever deployed.
  Matches today's local-only setup; gate behind a `TRUSTED_LOCAL=true` env so it can't accidentally
  ship. *(Resolved: add the env guard.)*
- **"Post everywhere" wall:** every official publish API is paid or approval-gated; SP1 publishes
  X-only and dry-run. Other channels are draft+copy until SP5. *(Resolved per guardrails.)*
- **rls.test.ts** may assume the anon/cookie path; if it breaks, adapt it to test policies directly
  rather than deleting it. *(Flag for the plan.)*
- **`next build` with removed routes:** ensure no dangling imports to `/login` or `/auth`. *(Plan task.)*
```
