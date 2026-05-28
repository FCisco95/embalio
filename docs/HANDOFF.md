# Resonance — Handoff (canonical)

**Last updated:** 2026-05-28
**Branch:** `main` — all work committed, clean tree. Pushed to github.com/FCisco95/dispatchAI (private).
**Scope:** local, single-user "engagement engine" (see the pivot below).

This is the canonical, living handoff for this repo. It is auto-loaded at the
start of each session by the `handoff-memory` plugin's SessionStart hook.
Point-in-time session snapshots live in `docs/handoffs/`.

---

## TL;DR

Resonance (now also known as **dispatchAI** on GitHub) built **Spine 2** — the
Content Intelligence Agent — on top of Spine 1. The `/compose` page now generates
3-5 weekly posts from parallel web research + personal context in one click. A new
`/engage` page surfaces daily reply opportunities from seed accounts with drafted
replies ready to copy.

> **▶ DO THIS NEXT (set 2026-05-28, resume after midnight limit reset):**
> We're pivoting dispatchAI into a **ViewCreator.ai-style multi-channel content
> cockpit** (no login, one-click tile grid, post quality voice-consistent content
> to every social on fresh data). The brainstorm is PAUSED mid-design.
> 1. Run the saved research workflow:
>    `Workflow({ scriptPath: "docs/superpowers/workflows/viewcreator-research.workflow.js" })`
> 2. Read **`docs/superpowers/notes/2026-05-28-viewcreator-cockpit-brainstorm.md`**
>    for the locked decisions, then continue the brainstorm (decompose the
>    multi-channel scope → design the first sub-project: no-login cockpit + X end-to-end).

**Older next-session options (now secondary):** wire in x-growth skills to
`buildAlgorithmRulesBlock()`, fix the 3 remaining Codex adversarial findings (§4),
or run `/x-strategist` on @FCisco95.

**Suggested skills next session:** `superpowers:brainstorming` (resume), then
`superpowers:writing-plans`. Also `superpowers:subagent-driven-development`.

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

---

## 3. What Spine 2 built — Content Intelligence Agent (2026-05-28)

Spec: `docs/superpowers/specs/2026-05-27-content-intelligence-agent-design.md`
Plan: `docs/superpowers/plans/2026-05-27-content-intelligence-agent.md` (8 tasks)

| Area | Files | What it does |
|---|---|---|
| New schemas (8) | `src/lib/schemas.ts` | WeeklyAngle, WeeklyAngleList, WeeklyPost, WeeklyPostPlan, ReplyCandidate, ReplyCandidateList, ReplyDraft, ReplyOpportunity, ReplyQueue |
| Handoff reader | `src/lib/handoff-reader.ts` | Reads `docs/HANDOFF.md` at runtime; returns fallback string on error |
| Prompt builders (8) | `src/lib/voice-prompt.ts` | buildCiscoContextBlock, buildWorldResearchPrompt, buildCrossRefSynthesisPrompt, buildWeeklyDraftPrompt, buildAlgorithmRulesBlock (stub), buildSeedScanPrompt, buildReplyFilterPrompt, buildReplyDraftPrompt |
| Weekly post generation | `src/server/original.ts` | `generateWeeklyPosts(profileId, journalEntry?)`: 3 parallel research calls → synthesis → parallel drafts → WeeklyPostPlan |
| Weekly composer UI | `src/components/weekly-composer.tsx` | Profile selector, optional journal textarea, "Generate this week's posts" button, rotating progress messages, post cards with format badge + editable text + copy |
| Reply queue server action | `src/server/engage.ts` | `generateReplyQueue(profileId)`: seed scan → filter → parallel reply drafts → ReplyQueue |
| Reply queue UI | `src/components/reply-queue.tsx` | Cards with target post + editable reply + Copy/View/Skip per card |
| /engage route | `src/app/(app)/engage/page.tsx` | New page wired to ReplyQueuePanel |
| Nav | `src/app/(app)/layout.tsx` | Engage link added (Board → Compose → Engage → Performance → Profiles) |
| /compose page | `src/app/(app)/compose/page.tsx` | Now renders WeeklyComposer instead of AngleComposer |

**96 tests pass, tsc clean, `next build` succeeds.**

### Key architecture decisions

- **Direction flip:** user's actual context (HANDOFF.md + journal entry) is Step 1; web research is Step 2 (context-adder, not driver)
- **5 post formats:** quick-take, experiment, tool-find, observation, reaction — each with specific structure + voice rules baked into the draft prompt
- **Algorithm hook stub:** `buildAlgorithmRulesBlock(format)` returns `""` — plug in x-growth skills here when ready (same hook for replies via `buildAlgorithmReplyRulesBlock`)
- **Reply format:** core technical fact → implication → stop at 2-4 sentences, zero preamble, never sycophantic

---

## 4. Current running state

- Local Supabase (Docker) + local dev server, `NEXT_PUBLIC_POSTING_ENABLED=true`,
  `GEN_BACKEND` unset (=subscription). `.env.local` has local Supabase keys +
  `CRON_SECRET=local-dev-cron-secret`; LLM/Apify keys empty (unused now).
- Dogfood data exists locally: profile `@cisco` (user `dogfood4@test.dev`) with
  voice_spec, 5 pillars, 14 seed_targets, 1 original draft.
- To resume: ensure Docker + `npx supabase start`, `npm run dev`, log in via
  Mailpit magic link (http://127.0.0.1:54324). PKCE flow lands on `/auth/callback`;
  use host `localhost:3000` consistently.
- GitHub remote: `git remote add origin https://github.com/FCisco95/dispatchAI.git` (already set)

---

## 5. Remaining Codex adversarial findings (from Spine 1 review)

Re-run after fixing: `/codex:adversarial-review --base 2f534ae`.

1. **[high] `postDraft` reports success even when follow-up DB writes fail** —
   `src/server/posting.ts:81-95`. The three post-confirmation writes
   (drafts.status, candidates.status, posting_jobs.status) don't check `.error`;
   Supabase doesn't throw by default. Can return `{ok:true}` while draft stays
   unposted / job stuck `running`. Fix: check each result, or wrap in a
   transactional RPC so success only returns when all commit.
2. **[high] Ambiguous posting outcome marked `failed` enables duplicate live
   posts on retry** — `src/server/posting.ts:98-108`. Fix: add a non-retryable
   intermediate state (e.g. `needs_manual_confirmation`) that blocks auto-retry
   until reconciliation. Needs a `posting_jobs.status` check-constraint migration
   + a `drafts` status like `unconfirmed`.
3. **[medium] `savePersona` non-atomic + no seed dedup** —
   `src/server/persona.ts:31-39`. Fix: single transaction (RPC) + dedup (unique
   constraint or upsert on normalized handle per profile).

---

## 6. Next developments (pick one; brainstorm first)

- **Wire x-growth skills into `buildAlgorithmRulesBlock(format)`** — 10 skills
  are complete in the vault. Plug format-specific rules (reach thresholds, CTA
  placement, thread length) into every draft + reply call. Run `/x-strategist`
  on @FCisco95 first to get account config that tunes the skills to real voice.
- **Fix Codex adversarial findings** (§5 above) — posting.ts correctness issues.
- **Account-research planner** — turn onboarding's proposed seed accounts into an
  ongoing "who to engage + why + a plan" view.
- **Metrics + strategy loop** — store engagements/reach (manual entry or Apify
  free tier) and surface "you've hit topic X 3×, reach Y — try Z."
- **Polish** — prefill the saved `voice_spec` back into the onboarding wizard for
  editing (`getPersona` exists but isn't wired to wizard `defaults`).

---

## 7. Tech debt / notes

- `npm test` requires local Supabase running (`rls.test.ts` integration test).
- `postTweetViaAdsPower` (Phase 1) is still live-only/untested (needs AdsPower install).
- Old `src/components/composer.tsx` (topic-based) and `src/components/angle-composer.tsx`
  are now unused — left in place; safe to delete later.
- Each web-research `generate` call takes ~50-90s; onboarding/angle steps are
  intentionally slow. The 120s runner timeout is tight for slow research — watch it.
- `buildAlgorithmRulesBlock` is a stub returning `""` — placeholder for x-growth skills.

---

*Provenance: updated 2026-05-28 after Spine 2 (Content Intelligence Agent) completion.*
