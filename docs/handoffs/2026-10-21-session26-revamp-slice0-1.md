# Embalio — Session 26 snapshot (2026-10-21): revamp interview → plan → slice 0 + slice 1

Canonical handoff: `docs/HANDOFF.md`. Plan: `docs/superpowers/plans/2026-10-21-revamp-plan.md`.

## 🗒️ SESSION 26 (2026-10-21) — REVAMP: interview → new plan → slice 0 + slice 1 built, reviewed, on a branch (NOT on main)

**TL;DR:** The owner asked for a from-scratch rethink ("don't assume the old plan; think with what exists
now"). A 3-round interview produced a new plan — **`docs/superpowers/plans/2026-10-21-revamp-plan.md`** —
and the session then built slices 0 and 1 of it. Embalio becomes a **phone-first approval queue (Hoje)**
over Supabase that **Claude Code skills fill every night** (1–3 original drafts per account, each with an
angle + rationale) using the **official X API (pay-per-use: $0.015/post, $0.005/read, no monthly fee)** and
xAI `x_search`; **approved originals publish through each account's own X OAuth**; replies stay intent-URL.
One operator, 3–5 accounts. **GATE-2 is closed NOT RUN** (one line in `docs/GOAL-LOG.md`; `/goal` retired).
**New gate = 30-day consistency**: ≥21 of 30 days with ≥1 published ORIGINAL per account (reply logs do
not count); reach is a weekly automatic read-out, not a gate; **day-14 tripwire**: <10 publish days on the
owner's own account → stop building UI.

**What exists now on branch `feat/revamp-slice0-contract` @ `7a66b73` (31 commits over `main`; suite
1242 pass / 1 skip, tsc clean, `npm run build` green — all three re-run by the controller at the end):**
- **Slice 0 — Day-0 contract:** `src/lib/x-api/types.ts` (`XClient`), five migrations `supabase/migrations/20261021_*.sql`
  (`x_accounts`; drafts `scheduled_at/angle/rationale/link_url` + status `scheduled` + `posting_jobs.method='xapi'` +
  `posts.tweet_id`; `target_allocations` with a one-target-one-profile trigger; `signal_cursors`; readout columns +
  `profiles.reach_insights`), `types.ts` reflected; nav → **Hoje · Replies · Performance · Contas** with Studio/Topics/
  Composer/Targeting under a sidebar **Labs** group; Apify crons removed from `vercel.json`.
- **Lane A (X backbone):** per-profile OAuth 2.0 PKCE (`/api/x/oauth/{start,callback}`; AES-GCM token storage,
  CAS-guarded refresh rotation, handle-mismatch guard, `x=…` outcome banner on `/profiles`), `src/server/publish.ts`
  (idempotent via the `posting_jobs` partial index; transport error = maybe-sent → `needs_manual_confirmation` + draft
  `unconfirmed`; reaper for stale `running` jobs; 15 s fetch timeouts; link posted as reply 1), queue Server Actions
  (`approveAndSchedule`, `editDraftBody`, `skipDraft`, `unscheduleDraft`, `clearDraftLink`, `confirmPublished`,
  `confirmNotPublished`), `ApprovalQueue` UI, `/api/cron/publish-due` (45 s budget).
- **Lane B (app surface):** `embalio_profile` cookie resolver + real `AccountSwitcher`; every page on
  `requireActiveProfile()`; `FIXED_PROFILE_ID` retired in favour of `assertOwnProfile` (only hit left:
  `api/cron/follower-snapshot`, deleted in slice 2); 30-day **consistency gate card** on `/performance`; shared
  `resolveCronProfiles`; nudge/telegram/strategy-weekly service-role code moved OUT of `"use server"` modules.
- **Lane E (engine):** `scripts/nightly-drafts.ts` (+ `src/lib/engine/*`, xAI `x_search` lane scan, `buildNightlyDraftsPrompt`),
  `.github/workflows/nightly-drafts.yml` (**06:30 UTC**, one combined notification per run), skill
  `.claude/skills/embalio-nightly/SKILL.md` (`/embalio-nightly`). A `--dry-run` against the real Supabase produced
  3 on-voice drafts for @fcisco95.
- **Process:** three lanes ran in parallel in isolated worktrees (Sonnet implementers, Opus reviewers, 1–2 fix rounds
  each), merged B → E → A, integration task, final whole-branch review (0 Critical, 6 Important) → one fix wave →
  clean re-review. Ledger with every ruling and deferred minor: `.superpowers/sdd/2026-10-21-revamp-plan/progress.md`
  (git-ignored, this machine only; the rulings are also in the session's final message).

**NOT done:** nothing is pushed (`main` auto-deploys to prod). Migrations NOT applied. No code run against real X or a
browser (switcher popover and Hoje on a phone viewport unchecked). `.env.example` could not be edited by any agent
(harness treats `.env*` as sensitive) → owner adds `X_CLIENT_ID`, `X_CLIENT_SECRET`, `X_TOKEN_ENC_KEY`. xAI request
shape for `x_search` is implemented from docs but unverified live (fails safe to "no lane scan").

**Owner queue — rollout order (from the final review):**
1. Pre-flight for the new unique index (must return 0 rows): `select profile_id, substring(tweet_url from '/status/(\d+)') t, count(*) from posts group by 1,2 having count(*)>1;`
2. Apply the five `supabase/migrations/20261021_*.sql` in the SQL editor (old code runs fine on the new schema; the reverse degrades, so migrate first).
3. X Developer portal: OAuth 2.0 app (confidential), callback `https://embalio.vercel.app/api/x/oauth/callback` (+ localhost), card + starter credits → `X_CLIENT_ID`/`X_CLIENT_SECRET`; `X_TOKEN_ENC_KEY` = base64 of 32 random bytes. Set all three in Vercel env + GitHub Actions secrets. Optional `XAI_API_KEY` (console.x.ai).
4. Push the branch, open the PR, merge to `main`.
5. Link @fcisco95 on `/profiles` (private window logged into that account).
6. `gh workflow run nightly-drafts.yml -f dry_run=true`, then a real run → drafts appear on Hoje.
7. One "Publicar agora" with a harmless post; one "Agendar" +10 min (the ticker is manual until step 8: `gh workflow run publish-due.yml`).
8. Only then schedule pg_cron: enable `pg_cron` + `pg_net`, `vault.create_secret('<CRON_SECRET>','cron_secret')`, `cron.schedule('publish-due','*/5 * * * *', …)` — SQL in the plan §2.
9. Day 1 of the 30 starts at the first real publish. Day-14 check: `/performance` gate card.

**Slice 2 (next build; before ANY second account is linked):** `embalio-onboard` wizard (E1), installable PWA + morning
push (B3), read-out writer + Performance reach (Lane D), weekly note (E4). Follow-ups logged for a Linear
`agent-proposed` issue (ask first): audit the remaining `"use server"` modules that call `supabaseService`
(`recommendTargets` in `target-queue.ts` is an unauthenticated LLM-cost action); anchor the `TweetUrl` regex
(`src/lib/schemas.ts`); the `unconfirmed` card should say a lost link reply is not recreated.

**Suggested skills next session:** handoff-memory (resume), superpowers:subagent-driven-development (slice 2 lanes
E1 ‖ B3 ‖ D, same ledger), `run` (browser check: switcher popover collapsed/expanded, Hoje at 390 px), promptfoo
(before changing `buildNightlyDraftsPrompt`), orca-linear (create the follow-up issue after asking).

## Generated artifacts this session

| What | Where it lives | Notes |
|---|---|---|
| Branch `feat/revamp-slice0-contract` (31 commits) | local repo only, not pushed | push + PR is an owner call; `main` auto-deploys |
| Five migrations `supabase/migrations/20261021_*.sql` | repo (branch) | NOT applied to prod; apply before merging |
| SDD ledger, briefs, reports, reviews | `.superpowers/sdd/2026-10-21-revamp-plan/` | git-ignored, this machine only |
| Task-observer observation 0031 | `~/.skill-observations/skill-observations/observation-log/` | SDD report path vs isolated worktree |
| Memory update | `~/.claude/projects/C--Users-joao--code-embalio/memory/embalio-q3-validate-freeze.md` | GATE-2 closed; revamp state |
| No keys, tokens or deployed resources were created | — | `X_TOKEN_ENC_KEY`, X app credentials, xAI key are owner steps, not yet generated |

## Next-session prompt

```
Embalio revamp: slice 0 + slice 1 are built, reviewed and merged on branch feat/revamp-slice0-contract @ 7a66b73 (31 commits over main; 1242 tests pass, tsc + build green). Nothing is pushed, migrations are not applied, no code has touched real X. GATE-2 is closed NOT RUN; the new gate is 30-day consistency (published originals), day-14 tripwire.

Files: docs/HANDOFF.md, docs/superpowers/plans/2026-10-21-revamp-plan.md, docs/GOAL-LOG.md, supabase/migrations/20261021_publish_xapi.sql, src/server/publish.ts, src/components/approval-queue.tsx, scripts/nightly-drafts.ts, .claude/skills/embalio-nightly/SKILL.md
Model: claude-opus-5 (high) — controller/architecture role per the routing table; implementers go to Sonnet through subagent-driven-development
Skills: handoff-memory, superpowers:subagent-driven-development, run, orca-linear

First confirm with the owner which rollout steps (HANDOFF.md Session 26, owner queue 1–8) are done. If the branch is merged and @fcisco95 is linked, run the browser check with `run` (switcher popover, Hoje at phone width) and then start slice 2 as three SDD lanes (E1 onboarding wizard ‖ B3 PWA + morning push ‖ D read-out) from the plan's §7/§3/§6, reusing the slice-1 ledger. If not merged yet, do not build: help the owner through the owner queue and stop.
```
