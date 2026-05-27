# Resonance Engagement Engine — Spine 1 Design

**Date:** 2026-05-27
**Status:** Approved (brainstorming) — pending spec review → implementation plan
**Repo:** `C:\Users\joao_\Desktop\projects\resonance` (branch `main`)
**Builds on:** the shipped v0 (profiles, scoring, drafting, board, composer, performance, Supabase + RLS).

---

## 1. Context & the larger vision

Resonance is becoming a **local, single-user "engagement engine"** for growing on tech Twitter (X) organically with effort — for the owner's own accounts first (primary handle "Cisco"), possibly productized later. The full vision is a product with ~6 subsystems:

1. **Onboarding / brand-voice + goals builder** ← *this spine*
2. Goals & growth plan
3. Account research (who to engage)
4. Live research (news / trends / what you've built)
5. Post & reply generation
6. Metrics + strategy feedback loop ("you've hit topic X 3×, reach Y — try Z")

Per decomposition, we build a **spine first** and grow it one sub-project at a time. This document specs **Spine 1 only**.

### Key decisions already made
- **Platform:** extend the existing **local Next.js app** (not a Tauri rewrite, not pure Claude Code skills). Tauri-wrapping can come later for a desktop feel.
- **Generation:** runs **free on the owner's Claude subscription, locally**, via the Claude Agent SDK / `claude` CLI as a subprocess — NOT the paid Anthropic API. (X API declined for cost; AdsPower-only posting from v0 Phase 1 stays as-is and out of scope here.)
- **Voice source:** the owner will **not** provide a corpus of past posts. The brand voice is **built by an onboarding interview**, then synthesized into a cached, editable voice spec.
- **Storage:** Supabase (already wired locally), not markdown/CSV — the later strategy loop needs queryable data.
- **Human-in-the-loop:** nothing auto-posts. The engine researches, suggests, drafts; the owner reviews and posts manually (copy out) for now.

---

## 2. Spine 1 scope

**In scope:** Onboarding interview → brand-voice + goals persona (stored, editable) → the owner's first AI-researched **original post** in that voice, reviewed by them.

**Out of scope (later spines):** reply/engagement cues at scale, the account-research planner, metrics/reach ingestion + strategy loop, deployment, and any auto-posting.

**Success criteria:**
- Creating/configuring a profile runs a guided interview that produces a **distilled, editable voice spec + goals + content pillars + proposed seed accounts**.
- Clicking "Draft a post" performs **live web research**, proposes a few **angles**, and on selection drafts a full in-voice post (single or short thread) + suggested visual, which the owner can edit and copy out.
- All generation runs through the **subscription-backed wrapper** (verified working) with a **Gemini free-tier fallback** if subscription-headless proves infeasible.

---

## 3. Architecture

```
Local Next.js app (run via `npm run dev`)
├── Onboarding wizard (client)  ──▶ server action: buildPersona()
│                                      └─ generate() ▶ synthesize voice spec + propose pillars/seed accounts
├── Composer "Draft a post" (client) ─▶ server action: proposeAngles() / draftPost()
│                                      ├─ research: WebSearch/WebFetch (niche news, GitHub trending, launches)
│                                      └─ generate() ▶ angles, then full draft in voice
├── generate() wrapper (server)  ──▶ Claude Agent SDK / `claude -p` subprocess  [subscription]
│                                      └─ fallback: Gemini free tier (@ai-sdk/google) if subscription headless fails
└── Supabase (local) — persona/goals/pillars on profiles; drafts as today
```

### 3.0 Step 0 — feasibility spike (gating, do first)
Before building features, verify that generation can run **headlessly through the subscription**: a minimal `generate(prompt)` that invokes `claude -p` (or the Agent SDK) and returns text, confirmed working against the owner's logged-in Claude Code. **If it fails** (subscription not usable unattended), the wrapper's backend switches to **Gemini free tier**; the rest of the design is unchanged because everything calls `generate()` behind a stable interface.

### 3.1 The `generate()` wrapper
- A single server-side module exposing a stable interface, e.g. `generateText(opts)` and `generateStructured(schema, opts)`.
- Default backend: Claude subscription via Agent SDK / `claude -p` subprocess (local only).
- Fallback backend: Gemini free tier via `@ai-sdk/google` (requires a free AI Studio key).
- Backend selected by an env flag (e.g. `GEN_BACKEND=subscription|gemini`).
- Structured output: enforce the existing Zod schemas (`DraftOutput`) — for the CLI backend, prompt for JSON and validate; for the SDK backend, use native structured output.

### 3.2 Onboarding interview
- A multi-step wizard (client) replacing the "paste corpus" flow.
- **Collects:** growth goal & target audience; niche & content pillars (default-seeded for Cisco: AI, agentic & generative AI, new features/launches, GitHub repos, building as a dev); voice (tone, formality, casing, emoji & hashtag policy, post length preference, do's/don'ts, admired accounts); no-go topics; cadence target (e.g. 3×/day).
- **Active step:** after collecting answers, `buildPersona()` calls `generate()` to (a) **synthesize a distilled voice spec** (a few hundred words of concrete, reusable voice guidance + 2–3 sample posts written in-voice for reference), and (b) **propose seed accounts + refined content pillars** from the niche, which the owner approves/edits.
- Output persisted to the profile; fully editable later.

### 3.3 Original-post flow
1. Owner clicks **"Draft a post"** (composer).
2. `proposeAngles()` runs live **web research** (WebSearch/WebFetch) for recent niche material (news, trending repos, launches) and returns **3–5 angles** spanning modes: *news-insight take*, *"I tested X — here's what I found"* experiment, *build-in-public*.
3. Owner picks an angle.
4. `draftPost()` produces a full post in the voice spec — single post or short thread as fits — plus a suggested visual.
5. Owner edits inline, then copies out to post manually. Draft + chosen angle stored.

---

## 4. Data model (migration `0004_persona.sql`)

Extend the existing `profiles` table directly (v0 already keys everything on `profile_id`, so new 1:1 columns avoid needless joins):
- `voice_spec text` — the synthesized, editable brand-voice guidance (supersedes `voice_corpus` for generation; corpus column may remain unused/optional).
- `goals text` — growth goal & target audience.
- `content_pillars text[]` — approved pillars.
- `onboarding_answers jsonb` — raw interview answers (kept for re-synthesis/audit).
- Seed accounts continue to use the existing `seed_targets` table (the onboarding proposer inserts approved suggestions there).

RLS: same ownership pattern as all existing tables. Drafts table unchanged.

---

## 5. Generation, voice, and reuse of v0

- Reuse and adapt `src/lib/voice-prompt.ts`: `buildVoiceSystem()` now consumes the **voice spec** (not a raw corpus). Reply/original prompt builders reused.
- `src/lib/drafting.ts` is **rewired** from `generateObject(anthropic(...))` to the new `generate()` wrapper. Public functions (`draftReply`, `draftOriginal`) keep their signatures so the board/composer keep working.
- `src/lib/models.ts` MODELS map updated to reflect backends (subscription model id / gemini fallback id).
- `DraftOutput`/`TweetUrl` schemas unchanged.

---

## 6. Error handling

- **Subscription/generation failure:** surface a clear error to the UI; if the configured backend errors, do not silently fall back per-request (backend is chosen by env to keep behavior predictable) — the fallback is a setup-time switch.
- **Web research empty/blocked:** proceed with reduced angles or prompt the owner to paste a source; never fabricate facts (carried over from v0's voice rules).
- **Structured-output parse failure (CLI backend):** retry once with a stricter JSON instruction; on second failure, return the raw text for manual cleanup rather than throwing.
- **Onboarding incomplete:** persona save requires the minimum fields (niche + at least voice tone + goal); the rest can be refined later.

---

## 7. Testing

- **Pure/TDD:** voice-spec assembly helpers, angle/mode selection logic, structured-output validation/parse-and-retry, any niche/seed proposal post-processing — unit-tested with mocked `generate()`.
- **Mocked:** `generate()` is mocked in all unit tests (no live model calls); the research step is injectable/mockable.
- **Manual / live:** the Step 0 subscription spike, the end-to-end onboarding→persona→first-post flow, and voice quality are verified manually in the browser (no API keys needed once the subscription backend works).
- Keep `npm test` green; the RLS integration test still requires local Supabase running.

---

## 8. Risks / open items

- **Subscription headless feasibility (primary risk):** addressed by the Step 0 spike + Gemini fallback. If neither the subscription nor a free tier is acceptable, scope reverts to paid API — to be decided then.
- **Voice quality from interview-only (no corpus):** mitigated by synthesizing sample in-voice posts during onboarding and making the voice spec editable; will need a few real iterations to dial in.
- **X DOM / posting** is unchanged from v0 Phase 1 (AdsPower, opt-in, untested) and is out of this spine.
- **ToS:** using a consumer Claude subscription to back an app is a gray area; acceptable for personal low-volume use, noted for awareness.

---

## 9. After this spine (sequencing)

Account-research planner → reply/engagement cues at scale (rewired to subscription) → metrics/reach ingestion (Apify free tier or manual entry, since Claude can't read X analytics) → strategy feedback loop. Each gets its own spec → plan → build cycle.
