# Handoff snapshot — Engagement Engine + Quiz redesign (2026-06-01, session 2)

## TL;DR

This session **pivoted** from "make Pulse real end-to-end" to a **product reframe**, then designed it end-to-end and wrote 2 of 3 implementation plans. The owner stopped to start **Plan C in a fresh session**.

**The reframe (now the product thesis):** Embalio is a **coach, not an autopilot**. The setup quiz is no longer a data form — it's the **control panel for a real Engagement Engine**. The product's value is **engagement quality**: non-generic, scenario-aware replies/posts. The keystone insight from research: X weights **a reply the original author replies *back* to ≈150× a like** — so every drafted reply is engineered to make the OP respond. There's no universal growth formula (Protocol ≠ Dev ≠ Founder ≠ Trader), so the quiz captures *which formula* the account needs; each answer becomes an engine knob.

## What was produced this session (all UNCOMMITTED — owner commits when ready)

- **Research grounding** (sourced): `docs/superpowers/notes/2026-06-01-x-growth-playbook-research.md` — X ranking weights, the anti-slop reply playbook (5 scenarios), per-platform rules, growth case studies, flagged uncertainties.
- **Design spec**: `docs/superpowers/specs/2026-06-01-engagement-engine-and-quiz-design.md` — supersedes the 2026-05-31 quiz spec. The 4-module engine (Targeting / Reply-craft / Post-craft / Platform), quiz-as-control-panel + knob mapping, Growth Plan artifact, the two flows, data model, V1 cut lines, build sequence, testing.
- **Plan A (written, NOT executed)**: `docs/superpowers/plans/2026-06-01-engagement-engine-core.md` — 8 TDD tasks: capture author followers from Apify; `account_size`/`daily_capacity`/`reply_playbook` columns (+ `drafts.engagement_scenario`); `knobsFromProfile`; size-fit + crowding in `compositeScore`; scenario-aware anti-slop `reply-craft` prompt; wire into `targeting.ts`; persist account_size/capacity in `finalizeSetup`.
- **Plan B (written, NOT executed)**: `docs/superpowers/plans/2026-06-01-flows-ui.md` — Scan→Engage screen + Create-a-Post flow, reusing the Dispatch design system (Card/Button/BrandAvatar/ScorePill).
- **Plan C — NOT written (deferred to next session).**
- **Validated mockups**: `.superpowers/brainstorm/*/content/*.html` (Scan→Engage, Growth Plan, crafting moment, engine-reframe). ⚠️ `.superpowers/` is **gitignored** — these won't sync; the spec describes them in prose.

## V1 scope decisions (owner-approved this session)

- Growth Plan = a **real saved artifact** (not just config). Quiz is **archetype-driven** and chaptered (Deepstash-style: emoji options, sectioned progress, reflective interstitials, an animated "crafting your growth plan" moment).
- **X active in V1**; LinkedIn/YouTube **defined-but-not-acted-on** (captured for later). Local, single account, perfected first. **No auto-engage** (stays human-in-the-loop).
- UI must match the existing **Dispatch design system** (enforced in spec §5 + Plan B/C tasks).

## Environment / live-run status

- **Keys now provisioned** in `.env.local` on this Windows machine: `APIFY_TOKEN`, `OPENAI_API_KEY`, `APIFY_TWEET_SCRAPER_ACTOR=apidojo/tweet-scraper` (Supabase, Telegram, `CRON_SECRET`, `FIXED_PROFILE_ID` were already set). `claude -p` verified working; the apidojo actor is reachable (HTTP 200).
- **The live `/setup` + Pulse run was PARKED, not completed.** No DB writes happened (the quiz was abandoned mid-way). The demo `@naval` rows in `candidates`/`drafts` are **untouched** (cleanup still pending — leave `seed_targets`).
- **Bug found (not yet fixed):** `src/components/setup-quiz.tsx` `stepComplete()` ignores the goal step's open-text (`goalOpen`), so typing a custom goal never enables "Next." `answersToInterview` already consumes `goalOpen`, so the fix is in `stepComplete` only. **Fold into Plan C** (the quiz is being rebuilt) rather than patching the old component.
- **Dev gotcha:** editing `.env.local` while `next dev` (Turbopack) runs corrupted the `.next` cache → a `/setup` reload loop. Fix: stop dev, `rm -rf .next`, restart.

## What to do next (next session)

1. *(Optional, owner's call)* **Commit** the research note + spec + Plan A + Plan B + this handoff (conventional commits, on `make-it-true` — re-check branch first; other agents may share the tree).
2. **Write Plan C** — quiz redesign + Growth Plan artifact — use **writing-plans**. Reuse the spec + the mockups in `.superpowers/brainstorm/`. Fold in the `goalOpen` fix.
3. **Execute Plan A** (engine core), then **Plan B** (flows UI) — TDD, `npm test` green (NEVER `RUN_RLS_INTEGRATION=1`) + `npm run build` clean after each task.
4. *(After engine + UI land)* resume the **live `/setup` + Pulse** run (keys are ready); verify Apify field-mapping against real output (`src/lib/apify.ts` — author follower field name is unverified); then clean up the demo `@naval` candidate/draft rows.

## Suggested skills for next session

- **writing-plans** — to author Plan C.
- **subagent-driven-development** (or **executing-plans**) — to implement Plans A & B task-by-task.
- **brainstorming** — only if the quiz design needs further refinement before Plan C.
- **frontend-design** — optional, for the styled quiz/Growth-Plan screens (must still match the Dispatch design system).
