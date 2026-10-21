# Codex handoff — finish the 2026-10 revamp, slice 1 → rollout → slice 2

Written 2026-10-21 at the end of Claude session 26. Canonical state: `docs/HANDOFF.md` (Session 26 entry). Plan: `docs/superpowers/plans/2026-10-21-revamp-plan.md`. Snapshot: `docs/handoffs/2026-10-21-session26-revamp-slice0-1.md`.

## State right now (verified by the controller, not claimed)
- Branch `feat/revamp-slice0-contract` @ `57eb1d3`, 32 commits over `main`, **not pushed**.
- `npm test` 1242 pass / 1 skip · `npx tsc --noEmit` clean · `npm run build` green.
- Five migrations `supabase/migrations/20261021_*.sql` exist and are **not applied** to prod (`vzxpakxjnuaesfxihyvl`).
- No code has touched real X. No browser check done. `.env.example` is unwritable for agents — the owner adds `X_CLIENT_ID`, `X_CLIENT_SECRET`, `X_TOKEN_ENC_KEY` by hand.
- Three harness worktrees still exist under `.claude/worktrees/agent-*` (branches `worktree-agent-*`, all merged).
- SDD ledger with every ruling/deferred minor: `.superpowers/sdd/2026-10-21-revamp-plan/progress.md` (git-ignored, Windows machine only).

## Hard rules
1. **Never merge to `main` and never push `main`** — it auto-deploys to prod; the owner merges after applying the migrations. Pushing the feature branch and opening a PR is fine.
2. TDD (failing test first). Suite + tsc + build green before every commit. Conventional commits.
3. Do not edit `.env*`. Do not apply migrations. Do not create Linear issues without asking the owner first (repo `AGENTS.md`).
4. Replies never go through the X API; a URL never rides in a main tweet body.

## Tasks, in order
1. **Push + PR.** `git push -u origin feat/revamp-slice0-contract`; open a PR to `main` titled "Revamp slice 0 + 1: approval queue, X OAuth publish, nightly drafts, consistency gate". Body = the Session 26 TL;DR + the owner rollout queue (steps 1–8 from `docs/HANDOFF.md`). Do not merge.
2. **Browser check** (`npm run dev`, Playwright or manual): sidebar account-switcher popover not clipped (collapsed + expanded), Hoje at 390 px wide (ApprovalQueue cards, buttons reachable), `/profiles?x=mismatch&handle=a&expected=b&profile=<id>` banner renders. Fix only what is broken (CSS/overflow), with a render test.
3. **Cleanup.** After `git branch --merged` confirms the three `worktree-agent-*` branches are merged: `git worktree remove .claude/worktrees/agent-<id>` ×3 and delete the branches. Commit nothing for this.
4. **Linear follow-up (ask first).** Propose one `agent-proposed` child issue: audit every `"use server"` module that calls `supabaseService` (constraint: service-role cores live in plain `server-only` modules); `recommendTargets` in `src/server/target-queue.ts` is an unauthenticated LLM-cost action; anchor the `TweetUrl` regex in `src/lib/schemas.ts`; the `unconfirmed` queue card should say a lost link reply is not recreated. Create it only if the owner says yes.
5. **Slice 2 — only after the owner confirms the branch is merged AND @fcisco95 is linked on `/profiles`.** Three lanes, disjoint files, same plan:
   - **E1** `.claude/skills/embalio-onboard/SKILL.md` + `scripts/onboard.ts`: pull last ~200 own posts via `XClient.getUserTweets`, impressions-by-topic → `profiles.reach_insights`, interview (AskUserQuestion-style in Codex), write `voice_spec`/`content_pillars`/`niche_description` via the `save_persona` RPC; refuse near-identical pillars across managed profiles. Plan §7 E1.
   - **B3** installable PWA: register `public/sw.js` globally with a network-first fetch handler, `src/app/manifest.ts` (`start_url:"/"`, id, scope, maskable icons), Apple meta, `h-dvh` + safe areas, push opt-in on Hoje. Plan §3 PWA bullet.
   - **D** read-out: `src/lib/x-api/readout.ts` `runReadout(sb, profileId)`, `/api/cron/readout`, `scripts/readout.ts`, `.github/workflows/readout.yml`; replace the Apify `follower-snapshot` route (delete it — the last `FIXED_PROFILE_ID` hits live there); `analytics_daily` upsert must only send `impressions, likes, replies, reposts, bookmarks, engagements, api_updated_at`. Plan §6.
   Before a second account is linked, the handle-mismatch guard already exists (`/api/x/oauth/callback`); keep it.

## Decisions already taken (do not re-litigate)
- GATE-2 closed NOT RUN; gate = ≥21/30 days with ≥1 published ORIGINAL per account (reply logs excluded); day-14 tripwire.
- Nightly job 06:30 UTC, one combined notification per run. Scheduling trigger = Supabase pg_cron every 5 min (owner sets it up last).
- Maybe-sent publish (transport error / 2xx without id / killed function) → `needs_manual_confirmation` + draft `unconfirmed`, resolved by the operator with Publicado / Não publicado. HTTP 5xx stays retryable.
- Service-role code never lives in `"use server"` modules (`posts-core.ts`, `strategy-weekly.ts`, `telegram-poll.ts`, `nudge.ts` are plain `server-only`).

## Owner-only steps (print them, do not do them)
1. Pre-flight for the new unique index — must return 0 rows: `select profile_id, substring(tweet_url from '/status/(\d+)') t, count(*) from posts group by 1,2 having count(*)>1;`
2. Apply the five `20261021_*.sql` migrations in the Supabase SQL editor.
3. X Developer portal OAuth 2.0 app (confidential), callback `https://embalio.vercel.app/api/x/oauth/callback`, card + credits → `X_CLIENT_ID`, `X_CLIENT_SECRET`; `X_TOKEN_ENC_KEY` = base64 of 32 random bytes; set in Vercel + GitHub secrets; optional `XAI_API_KEY`.
4. Merge the PR. 5. Link @fcisco95 on `/profiles` (private window). 6. `gh workflow run nightly-drafts.yml -f dry_run=true`, then real. 7. One "Publicar agora" test post, one "Agendar" +10 min (`gh workflow run publish-due.yml` until pg_cron exists). 8. pg_cron: enable `pg_cron` + `pg_net`, `vault.create_secret('<CRON_SECRET>','cron_secret')`, `cron.schedule('publish-due','*/5 * * * *', …)` — SQL in plan §2.
