# Session 9 snapshot — 2026-06-08 — Growth-operator pivot + Phase 1a shipped

Point-in-time snapshot. Canonical living state: `docs/HANDOFF.md` (Session 9 block).

## What happened

Embalio repositioned from "personal content OS" → **AI growth-operator product** (sellable). Decided via a full brainstorm → spec → plan → subagent-driven build session.

Shipped **Phase 1a: Credibility Gate + Daily Coach** — the "one gated assignment a day" loop (the brain that wraps the `x-*` skills). 8 commits, 366 tests green, `next build` clean, fast-forwarded onto `feat/recording-cockpit`, pushed to origin.

## The product (one line)

> Your AI growth operator: decodes any platform's algorithm and runs your daily growth FOR you — roadmap → daily task → ideas in your brand voice → gamified. Assist, not automation. Multi-platform via swappable packs; X first.

## Locked decisions (do not re-litigate — full rationale in the vault spec)

1. **Hybrid AI-cost** — connect-your-Claude-Code/BYO-key door (devs, $0 inference) + managed door (creators, app pays ~$2–5/user/mo behind hard per-user spend caps + cheap-model routing + caching + Batch API).
2. **Assist, not automate** — app researches/gates/drafts/stages; user publishes. (X killed its free API + bans automated engagement; LinkedIn API gated; authentic human action ranks.)
3. **One product for everyone** (creators + devs) — platform packs shipped in sequence, not audience-segmented.
4. **Dogfood solo first → then Stripe.**
5. **Stack:** Supabase + Vercel, daily job on Supabase `pg_cron`. Not AWS early.

## Architecture

Platform-agnostic **core** (account/brand-voice · credibility-gate · roadmap · daily-coach · trend-runner · gamification · notifications · metrics) + swappable **platform packs** (algorithm rules + research sources + format templates + publish-flow). X pack = the existing `x-*` knowledge. Pack abstraction itself is deferred until the 2nd platform (Phase 4) — Phase 1 stays X-shaped.

## Files shipped (Phase 1a)

- `src/lib/schemas.ts` — `CredibilityVerdict` schema added.
- `src/lib/credibility/prompt.ts`, `gate.ts` (+ tests) — `gateTrend()`, fails safe to keep=false.
- `src/server/credibility.ts` (+ test) — `gateTrends(profileId, trends)` → keepers only.
- `src/lib/coach/assignment.ts` (+ test) — pure `pickAssignment()`.
- `src/server/coach.ts` (+ test) — `getDailyAssignment(profileId)`.
- `src/components/coach-card.tsx` (+ test) — wired first in `src/app/(app)/page.tsx`.
- Zero schema migrations.

## Next

1. **Task 8 — dogfood** on @FCisco95; tune `src/lib/credibility/prompt.ts` strictness.
2. **Phase 1b — retention** (needs a plan): streak (silent freeze + endowed progress + grace) + one loss-framed daily nudge (capped, silent opt-out) + Telegram callback webhook (`runPulse` Posted/Skip buttons are dead). Branch `feat/streak-nudge` off `feat/recording-cockpit`.
3. **Phase 1c — cost:** wire `src/lib/models.ts` routing + per-user caps.

## Vault references (cisco-brain)

- Spec: `10 - PROJECTS/Embalio/specs/2026-06-08-growth-operator-design.md`
- Plan: `10 - PROJECTS/Embalio/plans/2026-06-08-credibility-gate-daily-coach.md`
- Research: `10 - PROJECTS/Embalio/research/Embalio — Research — 6 Growth-Hacking Product (Superbird teardown + landscape + wedge).md`
- Roadmap: `10 - PROJECTS/Embalio/_hub/Embalio — Next Steps.md`

## Risks (from final review)

Morning gate = ~6 LLM calls/dashboard-load, guarded to fire only when not-posted (cache later). Gate angle needs a configured profile (pillars + niche). `isToday` uses server-local time. Connect-Claude door is the least-proven piece — dogfood validates it.
