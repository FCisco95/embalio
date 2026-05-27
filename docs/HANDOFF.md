# Resonance — Handoff (canonical)

**Last updated:** 2026-05-27
**Branch:** `main` — all work committed, clean tree.
**Scope:** local, single-user "engagement engine" (see the pivot below).

This is the canonical, living handoff for this repo. It is auto-loaded at the
start of each session by the `handoff-memory` plugin's SessionStart hook.
Point-in-time session snapshots live in `docs/handoffs/`.

---

## TL;DR

Resonance pivoted from "deploy-to-Vercel SaaS" toward a **local, single-user
engagement engine** that generates content **free on the owner's Claude Code
subscription** (the app shells `claude -p`, no paid API), and built **Spine 1**
of that engine end-to-end, verified live in a browser.

**Next session: fix the 3 Codex adversarial findings (§4), then pick a next spine (§5).**

**Suggested skills next session:** `superpowers:subagent-driven-development`
(execute fixes/next spine task-by-task), `superpowers:brainstorming` (before
designing a new spine), `superpowers:test-driven-development`,
`/codex:adversarial-review --base 2f534ae` (re-run after the fixes).

---

## 1. The pivot (key decisions)

- **Platform:** keep extending the existing **local Next.js app** (NOT a Tauri
  rewrite, NOT pure Claude Code skills). Run via `npm run dev`.
- **Generation is FREE via the Claude subscription:** all AI calls go through a
  `generate()` wrapper that shells `claude -p`. No Anthropic/OpenAI API keys, no
  per-token cost. A Gemini free-tier fallback is wired (`GEN_BACKEND=gemini`,
  `@ai-sdk/google`) but unused (`GEN_BACKEND` defaults to `subscription`).
  - Verified: `claude -p` and `claude -p --allowedTools WebSearch WebFetch` work
    headlessly and return JSON. See `docs/superpowers/notes/2026-05-27-subscription-spike.md`.
  - **Constraint:** only works locally where `claude` is authenticated. NOT
    compatible with Vercel cron — the deployed v0 path and this local engine are
    different runtimes.
- **Voice is built by an onboarding interview, NOT a pasted corpus** (owner won't
  supply old posts). Interview answers are synthesized into an editable `voice_spec`.
- **Human-in-the-loop:** nothing auto-posts; the engine researches/suggests/drafts,
  the owner reviews and copies out.
- **X API still declined** (cost); posting stays AdsPower-only (Phase 1, opt-in, untested).

Spec: `docs/superpowers/specs/2026-05-27-engagement-engine-spine1-design.md`
Plan: `docs/superpowers/plans/2026-05-27-engagement-engine-spine1.md` (11 tasks)

---

## 2. What Spine 1 built (all committed on main)

| Area | Files | Commits |
|---|---|---|
| `generate()` wrapper: `claude -p` (stdin, `shell:true`, 120s timeout) + Gemini fallback; `generateStructured` with robust JSON parse (largest balanced region) + 1 retry; `GEN_BACKEND` guard | `src/lib/generate/{runner,index,parse,gemini}.ts` | `9dfdc8e`, `7ed81ab`, `bfbb44b`, `5ad0ff2`, `0653133` |
| Persona columns | `supabase/migrations/0004_persona.sql` (voice_spec, goals, content_pillars, onboarding_answers on `profiles`) + regen types | `0a028fc` |
| Schemas + prompt builders (explicit JSON shapes) | `src/lib/schemas.ts`, `src/lib/voice-prompt.ts` | `6741dac`, `855c3eb` |
| Drafting rewired to wrapper (voice_spec-aware; signatures unchanged) | `src/lib/drafting.ts` | `fcc13f2` |
| Persona actions | `src/server/persona.ts` (synthesizePersona/getPersona/savePersona) | `820c3fd` |
| Onboarding wizard UI | `src/components/onboarding-wizard.tsx` (mounted in `profile-card.tsx`) | `39f5424` |
| Original-post actions | `src/server/original.ts` (proposeAnglesForPillars/draftFromAngle/composeOriginalForProfile/getProfilePillars) | `1e98b27` |
| Angle composer UI | `src/components/angle-composer.tsx` (replaces old `composer.tsx` on `/compose`) | `ab71e13` |

**Live end-to-end verification (real `claude` calls, in browser):** onboarding
interview → 51s web research → synthesized voice_spec (nailed "lowercase,
technical, no hype") + 5 pillars + 14 real seed accounts (@karpathy, @simonw,
@swyx…) saved to DB → `/compose` angle research (57s) produced 5 current on-niche
angles → drafted the QuantSpec "experiment" angle into an in-voice post (with
arXiv source) persisted to `drafts`. **48 tests pass, tsc clean, `next build` succeeds.**

---

## 3. Current running state

- Local Supabase (Docker) + local dev server, `NEXT_PUBLIC_POSTING_ENABLED=true`,
  `GEN_BACKEND` unset (=subscription). `.env.local` has local Supabase keys +
  `CRON_SECRET=local-dev-cron-secret`; LLM/Apify keys empty (unused now).
- Dogfood data exists locally: profile `@cisco` (user `dogfood4@test.dev`) with
  voice_spec, 5 pillars, 14 seed_targets, 1 original draft.
- To resume: ensure Docker + `npx supabase start`, `npm run dev`, log in via
  Mailpit magic link (http://127.0.0.1:54324). PKCE flow lands on `/auth/callback`;
  use host `localhost:3000` consistently.

---

## 4. IMMEDIATE TO-DO: fix Codex adversarial findings (verdict: needs-attention)

Re-run after fixing: `/codex:adversarial-review --base 2f534ae`.

1. **[high] `postDraft` reports success even when follow-up DB writes fail** —
   `src/server/posting.ts:81-95`. The three post-confirmation writes
   (drafts.status, candidates.status, posting_jobs.status) don't check `.error`;
   Supabase doesn't throw by default. Can return `{ok:true}` while draft stays
   unposted / job stuck `running`. Fix: check each result, or wrap in a
   transactional RPC so success only returns when all commit.
2. **[high] Ambiguous posting outcome marked `failed` enables duplicate live
   posts on retry** — `src/server/posting.ts:98-108`. Unconfirmed-URL path sets
   job `failed`; the partial unique index only blocks `running`/`succeeded`, so a
   retry can post a second tweet while the first was live-but-unconfirmed. Fix:
   add a non-retryable intermediate state (e.g. `needs_manual_confirmation`) that
   blocks auto-retry until reconciliation. (Residual risk already flagged in the
   Phase 1 handoff; Codex confirms it's worth closing — needs a `posting_jobs.status`
   check-constraint migration + a `drafts` status like `unconfirmed`.)
3. **[medium] `savePersona` non-atomic + no seed dedup** —
   `src/server/persona.ts:31-39`. Updates profile then inserts seed_targets
   one-by-one; mid-loop failure leaves partial state, and repeated submissions
   accumulate duplicate handles. Fix: single transaction (RPC) + dedup (unique
   constraint or upsert on normalized handle per profile).

---

## 5. Next developments (pick one; brainstorm first)

Per the larger vision (a strategic content + engagement engine), remaining spines:

- **Reply/engagement cues at scale** — rewire the existing v0 board/targeting to
  the subscription `generate()`; surface a daily queue of seed-account posts worth
  replying to, with drafted replies. (Highest growth ROI: replies = reach,
  originals = conversion.)
- **Account-research planner** — turn onboarding's proposed seed accounts into an
  ongoing "who to engage + why + a plan" view.
- **Metrics + strategy loop** — store engagements/reach (Apify free tier or manual
  entry, since Claude can't read X analytics) and surface "you've hit topic X 3×,
  reach Y — try Z."
- **Polish** — prefill the saved `voice_spec` back into the onboarding wizard for
  editing (wizard currently resets on reload; `getPersona` exists but isn't wired
  to the wizard `defaults`); a "regenerate angle" button.

Strategy guidance: lead with replies (reach), keep originals high-quality +
niche-anchored (not generic trend-chasing), keep human approval before posting.

---

## 6. Still blocked on the owner (from v0)

- **v0 deploy** — owner provisions a fresh free Supabase + Vercel account
  (separate from Organic). Turnkey runbook in
  `docs/handoffs/HANDOFF-v0-phase1.md` (if migrated) or the vault archive. Note:
  the deployed Vercel path can't use subscription generation; deploying the
  *engagement engine* would require paid API or keeping generation local. Decide
  the deployment story when revisiting.

---

## 7. Tech debt / notes

- `npm test` requires local Supabase running (`rls.test.ts` integration test).
- `postTweetViaAdsPower` (Phase 1) is still live-only/untested (needs AdsPower install).
- Old `src/components/composer.tsx` (topic-based) is now unused (replaced by
  angle-composer) — left in place; safe to delete later.
- Each web-research `generate` call takes ~50-90s; onboarding/angle steps are
  intentionally slow. The 120s runner timeout is tight for slow research — watch it.
- Anthropic prompt-cache (v0 drafting) is moot now that drafting goes through `claude -p`.

---

*Provenance: this canonical doc was seeded 2026-05-27 from the session snapshot
`docs/handoffs/2026-05-27-engagement-engine-spine1.md` (originally written to the
Obsidian vault before handoffs were moved in-repo).*
