# Embalio — Session 10 snapshot (2026-06-11): P2 Topic Board shipped + dogfooded

> Snapshot of the Session 10 section of docs/HANDOFF.md. Canonical lives there.


## 🗒️ SESSION 10 (2026-06-11, evening) — P2 Topic Board SHIPPED end-to-end + phone dogfood PASSED

**TL;DR:** P2 (the #1 pain: stale topics) shipped same-day, subagent-driven: `/topics` mobile board (score 0-100 + why-chips + freshness stamps + dated citations + one-tap Draft this), pure scorer, never-empty freshness chain, and a $0 GH Actions refresh worker running claude CLI on Max-plan OAuth. **Step-zero infra unblock first**: Vercel Hobby prod + `signal-crons.yml` scheduler (warehouse was frozen at 278 rows — now growing). Suite 442 → **488 green**. Phone dogfood passed live: PWA installed → board → Draft this → voiced Gemini draft in sign-off queue (verified in `drafts` table). Note: P0+P1 shipped the same morning (separate session; see vault task docs — that session didn't write a handoff section here).

**Canonical docs (don't re-litigate):**
- Spec: vault `10 - PROJECTS/Embalio/specs/2026-06-11-growth-operator-revamp-design.md` (12 locked decisions)
- P2 plan (all tasks done): repo `docs/superpowers/plans/2026-06-11-p2-topic-board.md`
- Roadmap: vault `10 - PROJECTS/Embalio/_hub/Embalio — Next Steps.md` (P0/P1/P2 marked shipped)

**What shipped (this repo, commits 3534816..9ab6505 — 14 commits on main):**
- `src/lib/topics/` — `schemas` (dated `sources.min(1)` zod-required; sourceless generation auto-retries), `heat.ts` (topic velocity from own `signal_tweets`, 24h vs prior 24h — sanity-checks LLM trend claims), `score.ts` (pure 0-100: niche 35 / heat 30 / cred 20 / timing 15; react/verdict/saturated windows), `board.ts` (full pipeline: warehouse-grounded generation → gateTrend → embed → heat → score → persist `topic_history`; worker-safe, injected Supabase client, NO next/* imports), `dispatch.ts` (workflow_dispatch background refresh, env-gated `GITHUB_DISPATCH_TOKEN` — optional, not yet set), `format.ts` (`formatAgo`, null = don't render).
- `src/server/topics.ts` — `getTopicBoard` 5-state freshness chain (fresh <60min → cached + background dispatch → today's `research_briefings` low-confidence → ≤48h stale banner → labeled empty; phone NEVER triggers live LLM) + `draftFromTopicRow(profileId, topicId)` — IDs only, row re-read server-side (review-driven security fix).
- `src/app/(app)/topics/` + `src/components/topics/` — mobile board UI; nav now Home · **Topics** · Engage · Composer · Reach (`src/components/shell/nav-items.ts`; Brand Voice demoted from primary).
- `src/lib/voice-prompt.ts` — `buildTopicBoardPrompt` (LLM ranks against injected high-velocity warehouse tweets; all scraped fields sanitized + whitespace-collapsed — prompt-injection review fixes).
- `scripts/refresh-topics.ts` + `.github/workflows/refresh-topics.yml` — worker every 3h waking UTC, claude CLI on `CLAUDE_CODE_OAUTH_TOKEN` secret (rides Max plan), Gemini fallback, skips pillarless profiles.
- `.github/workflows/signal-crons.yml` — curls `/api/cron/targeting|tracking` (2h waking) + `/api/cron/follower-snapshot` (daily 00:45Z) with `CRON_SECRET` bearer against prod.
- `src/lib/generate/gemini.ts` — **`gemini-2.5-flash`** (Google shut down `gemini-2.0-flash` 2026-06-01; env-overridable `GEMINI_MODEL`).

**Infra state (all verified live-fire):**
- Vercel: project linked (`ciscos-projects-c3b3be54/embalio`), 13 prod env vars incl. `GEN_BACKEND=gemini` + `GOOGLE_GENERATIVE_AI_API_KEY` (created during dogfood debugging). GitHub-connected: push to main = auto prod deploy.
- GH secrets: `CRON_SECRET`, supabase URL/service key, `OPENAI_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, `GOOGLE_GENERATIVE_AI_API_KEY`; variable `APP_BASE_URL`. **Windows gotcha (cost ~1h): never pipe tokens into `gh secret set` — trailing `\r` breaks API headers; use `--body`. Recorded in Claude memory.**
- CI worker live-fired green: `board written: @fcisco95 → 4 topics` from GitHub runners; scheduled crons self-firing since.
- Warehouse: signal_tweets 278 → 323+ and growing; `topic_history` serving fresh boards.

**NEXT (in order):**
1. **P3 — KPI dashboard + CSV import** (4-5 days; spec section 7): header-tolerant fail-loud CSV import (only source for profile-visits/follows), `getKpis()` aggregator, `/performance` card grid + drill-downs, follower star card on home, follow-conversion north star. Open with its own `writing-plans` cycle.
2. Residual dogfood: Engage one-tap Done from phone + nudge/Telegram triggers (P0 leftovers).
3. Optional polish: `GITHUB_DISPATCH_TOKEN` on Vercel (enables in-app background refresh; scheduled cadence already covers freshness), upgrade actions/checkout+setup-node to Node-24-ready versions before 2026-06-16 (CI deprecation warning).

**Suggested skills next session:** `superpowers:writing-plans` (P3 plan from spec section 7) → `superpowers:subagent-driven-development` (mirror the P2 loop: TDD + spec-review + quality-review per task) → `superpowers:verification-before-completion`. Read this handoff + spec before any code.

**Risks/notes:** topic_history RLS disabled (service-role-only posture, same as research_briefings) — revisit in P7 hardening. `expire→insert` in `board.ts` is non-atomic (next scheduled run self-heals; fine for worker). Stub `@a` profiles in prod DB are skipped by the worker but still pollute `profiles` — consider cleanup. Free-tier Gemini limits: ~10 RPM — fine for single-user dogfood.

---

## 🗒️ SESSION 9 (2026-06-08) — Repositioned to AI growth-operator; Phase 1a (gate + coach) SHIPPED

**TL;DR:** Embalio repositioned from "personal content OS" → **AI growth-operator product** (sellable). Ran the full brainstorm → spec → plan → subagent-driven build loop and shipped **Phase 1a: Credibility Gate + Daily Coach** — the "one gated assignment a day" loop, the brain that wraps the `x-*` skills. 8 commits, 366 tests green, build clean, fast-forwarded onto `feat/recording-cockpit` and pushed.

**Canonical strategy docs (in the cisco-brain vault — READ before continuing; don't re-litigate locked decisions):**
- Spec: `C:\Users\joao_\Documents\cisco-brain\10 - PROJECTS\Embalio\specs\2026-06-08-growth-operator-design.md` — 5 locked decisions: hybrid AI-cost (connect-Claude/BYO + managed-with-caps) · assist-not-automate · one product for everyone · dogfood-then-Stripe · Supabase+Vercel. Core + swappable platform packs (X first).
- Phase 1a plan (done): `…\10 - PROJECTS\Embalio\plans\2026-06-08-credibility-gate-daily-coach.md`
- Research: `…\10 - PROJECTS\Embalio\research\Embalio — Research — 6 Growth-Hacking Product (Superbird teardown + landscape + wedge).md`
- Roadmap: `…\10 - PROJECTS\Embalio\_hub\Embalio — Next Steps.md`

**What shipped (Phase 1a, this repo):**
- `src/lib/credibility/prompt.ts` + `gate.ts` — `gateTrend(pillars, niche, trend)` → `CredibilityVerdict` (fails safe to keep=false). `CredibilityVerdict` schema in `src/lib/schemas.ts`.
- `src/server/credibility.ts` — `gateTrends(profileId, trends)`: keeps only on-niche trends with an angle.
- `src/lib/coach/assignment.ts` — pure `pickAssignment()` (post → reply → rest; one assignment/day; never a 2nd post once posted).
- `src/server/coach.ts` — `getDailyAssignment(profileId)`: reads posts/candidates/`growth_plan`; runs `findHotTopics` + `gateTrends` ONLY when not-posted.
- `src/components/coach-card.tsx` — "your one job today" card, wired as the first card in `src/app/(app)/page.tsx` (reuses the existing `listProfiles()[0]` profile-id resolution).
- Zero schema changes. Reuses `generateStructured`, `findHotTopics`, `GrowthPlan`. Tests follow the Vitest mock-`@/lib/generate`-at-boundary pattern.

**NEXT (in order):**
1. **Task 8 — dogfood.** Run the app, open the dashboard for @FCisco95: confirm POST-with-gated-angle before posting, REPLY after. Tune `src/lib/credibility/prompt.ts` strictness if off.
2. **Phase 1b — retention layer (needs a plan).** ONLY three things: streak (silent freeze + endowed progress + grace) + one loss-framed daily nudge (capped, silent opt-out after ignores) + the **Telegram callback webhook** (the Posted/Skip buttons in `runPulse`/`src/server/pulse.ts` are currently dead — no handler at `src/app/api/telegram/webhook`). Realizes Ideas item #3. Hold the scope line.
3. **Phase 1c — cost.** Wire `src/lib/models.ts` routing (cheap model for the gate) + per-user spend caps (sets up the managed tier).
- Then Phase 2 Stripe (connect-Claude door) → Phase 3 managed tier → Phase 4 LinkedIn → YouTube → TikTok packs.

**Suggested skills next session:** `superpowers:brainstorming` (scope 1b, briefly) → `superpowers:writing-plans` → `superpowers:subagent-driven-development` (TDD + per-task review) → `superpowers:finishing-a-development-branch`. Mirror the Phase-1a loop. Cut Phase-1b as `feat/streak-nudge` off `feat/recording-cockpit`.

**Risks (from the final review):** the morning gate runs ~6 LLM calls per dashboard load — guarded to fire only when not-posted; fine for single-user dogfood, cache later. Gate angle needs a configured profile (pillars + niche). `isToday` uses server-local time. The connect-Claude door (running the loop in a user's Claude plan from the web app) is the least-proven piece — dogfood validates it.

Snapshot: `docs/handoffs/2026-06-08-growth-operator-phase1a.md`.

---

