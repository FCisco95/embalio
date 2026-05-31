# Onboarding Quiz — First-Account Setup (Design Spec)

**Date:** 2026-05-31
**Status:** Approved (brainstorm) — ready for implementation plan
**Branch target:** new branch off `make-it-true` (e.g. `feat/onboarding-quiz`)
**Scope:** Piece **B** only — the quiz-style first-account setup. Sibling pieces
tracked separately: **C** (wire X-algorithm skills into reply/Pulse prompts) and
**A** (make Pulse real with live keys). Finishing setup for the owner's profile
is what produces the voice + `seed_targets` that unblock A.

---

## 1. Why this exists

Embalio's features only work when a profile has real inputs: a **voice**
(for on-voice drafting + relevance scoring), **content pillars** (scoring +
recommendations), a **goal** (target sizing), and **seed_targets** (accounts to
watch). Today the owner's profile `fcisco95` has none of these — `niche_description`
NULL, no `voice_spec`, 0 `voice_corpus`, 0 `content_pillars`, 0 `seed_targets`.
The only profile-creation path is a legacy "paste your corpus" form
(`profile-form.tsx`) that requires you to already have material.

This feature is the **front door** to the engine. It is also the
"paid user with an empty account" entry point in the product vision: a focused,
quiz-style setup that captures exactly what the app needs to do a great job.

**The promise (north star for copy + behavior):** *Not automatic.* It makes
engaging effortless by **recommending who to follow**, **tracking your reach
goals**, and **drafting posts that sound like the same person wrote them.**
Human-in-the-loop throughout.

## 2. UX principles (decided)

- **Takeover pop-up.** Setup replaces the app chrome (no nav/sidebar) so there
  is nothing else to look at — maximum focus. A full list of fields would feel
  overwhelming; a single tap-sized question will not.
- **One question per screen**, with a short **explanation** above each question.
- **Tap-first.** Chips / toggles / buttons everywhere possible. Typing only where
  unavoidable (the @handle). Steps that benefit (pillars, goal, voice) also offer
  an optional **"something else…" open-text** field — never box the user in.
- **Progress indicator** ("Step 3 of 7"). Lifts completion 30–50% (Zeigarnik).
- **3–7 core steps**, progressive (simple → broad). First value moment is the
  generated voice profile + recommended accounts near the end.
- **Resumable.** Partial answers survive a refresh; never lose progress.
- **Never block on a missing integration.** If Apify/OpenAI/`claude` are
  unavailable, setup still completes with graceful fallbacks.

## 3. What we collect, and why

Each question earns its place by feeding a concrete feature. No schema migration
is required — every field maps to an existing `profiles` column; account-size and
daily-capacity ride in the existing `onboarding_answers` jsonb.

| # | Question | Input | Powers | Persisted to |
|---|----------|-------|--------|--------------|
| 1 | What's your X handle? | text (short) | identity; enables auto-pull of posts | `handle` |
| 2 | How big is the account today? | tap bucket (`<500` / `500–5k` / `5k–50k` / `50k+`) | calibrates who-to-follow sizing + realistic goals | `onboarding_answers.account_size` |
| 3 | X Premium? | tap yes/no | algorithm rules (length, reach weighting) | `premium_account` |
| 4 | What do you post about? | tap chips + open add | content pillars, relevance scoring, recommender | `content_pillars`, `niche_description` |
| 5 | Main growth goal? | tap (Followers / Reach / Leads / Authority) + open | north-star + tailors recommendations | `goals`, `north_star_metric` |
| 6 | How much time per day? | tap (`~10m` / `~30m` / `1h+`) | how many opportunities/pulses + cadence | `onboarding_answers.daily_capacity` |
| 7 | How should I learn your voice? | tap (Pull my posts / Paste a few / Just tags) + open | voice corpus → on-voice drafts | `voice_corpus`, `voice_notes` |
| → | **App generates** voice spec + **recommends accounts** | curate toggles | the voice + the watch list | `voice_spec`, `seed_targets` |
| → | **Done** → dashboard | — | scan → draft → Telegram can run for real | — |

DB columns confirmed present in the live database (no migration): `handle`,
`display_name`, `niche_description`, `voice_corpus[]`, `voice_notes`, `voice_spec`,
`goals`, `content_pillars[]`, `onboarding_answers` (jsonb), `north_star_metric`,
`premium_account`.

## 4. Architecture & components

Reuse the engine; build only the front door and one thin Apify wrapper.

### New
- **Route `src/app/setup/page.tsx`** — *outside* the `(app)` layout group so it
  renders without nav/sidebar (true takeover). Loads/creates the active profile,
  renders `<SetupQuiz>`.
- **`src/components/setup-quiz.tsx`** (client) — the step-machine:
  `stepIndex`, `answers`, per-step validation, back/next, progress bar. Resumable
  (partial answers persisted — see §6). On finish, drives the synthesize →
  recommend → curate → save sequence.
- **`src/lib/setup-steps.ts`** — the **`STEPS` config array**. Each entry:
  `{ id, question, explanation, kind: "text"|"single"|"chips"|"toggle", options?, allowOpenText?, required? }`.
  One data structure drives every screen — isolated, reorderable, unit-testable.
- **`src/server/voice-pull.ts`** — `pullOwnVoiceCorpus(handle): Promise<string[]>`,
  wrapping the existing Apify `pullTweets` to fetch the user's recent posts and
  return their text as a voice corpus. Gated on `APIFY_TOKEN`; throws a typed
  "unavailable" error the UI handles as a fallback (paste/tags).
- **Empty-account trigger** — a predicate `needsSetup(profile)` (no
  `voice_spec`/`content_pillars`) and a redirect into `/setup` from the app entry
  (dashboard/layout). Pure function, unit-tested.

### Reused (no changes to generation engine)
- `synthesizePersona(answers)` — `InterviewAnswers` → `{ voiceSpec, contentPillars, seedAccounts, samplePosts }`.
- `generateTargetQueue(profileId)` — recommended accounts from pillars + north-star.
- `savePersona(profileId, …)` — atomic RPC: updates profile fields + upserts `seed_targets`.
- `createProfile()` — for first profile creation if none exists.

### Retire / supersede
- The legacy single-form `onboarding-wizard.tsx` is superseded by `setup-quiz.tsx`.
  Keep `profile-form.tsx` only as an "advanced / paste corpus" path or remove from
  the default flow (decide in plan). Do not delete blindly — confirm no other route
  depends on it.

## 5. Data flow

1. User taps through steps; answers held client-side (+ optional open text).
2. Voice step "Pull my recent posts" → `pullOwnVoiceCorpus(handle)` → corpus
   (fallback to paste/tags on failure).
3. **Create/update the profile** with collected fields, then `synthesizePersona`
   → `voice_spec`. (Profile must exist before targets can be recommended.)
4. `generateTargetQueue(profileId)` → recommended accounts rendered as pre-toggled
   rows with a reason + fit signal each.
5. User curates toggles (+ optionally adds own) → `savePersona` persists profile
   fields and upserts the kept handles as `seed_targets`.
6. Redirect to dashboard. A real scan → draft → Pulse is now possible.

Sequencing note: profile creation/save precedes target recommendation because
`generateTargetQueue` takes a `profileId` and reads persisted pillars/north-star.

## 6. Error handling & resilience

- **Integration down (Apify/OpenAI/`claude`):** never block finishing setup.
  - Voice "pull" fails → fall back to paste/tags, with a short honest message.
  - `generateTargetQueue` fails → "add accounts manually now, or let the app
    suggest later," with a manual add field. Setup still completes.
  - `synthesizePersona` fails → save raw answers; voice spec can be regenerated
    later from the profile page.
- **Resumability:** persist partial answers (localStorage keyed by profile, or
  `onboarding_answers` on each step) so a refresh resumes mid-quiz.
- **Validation:** required steps block "Next"; optional steps skippable.
- **Idempotent save:** re-running setup updates the same profile and upserts
  `seed_targets` (existing `(profile_id, handle)` unique index dedupes).

## 7. Testing strategy

Pure-function unit tests (Vitest), server actions mocked — no live network:
- `STEPS` config integrity (ids unique, kinds valid, options present where required).
- `answers → InterviewAnswers` mapping (incl. open-text merge into pillars/notes).
- `needsSetup(profile)` predicate across empty/partial/complete profiles.
- Curation → `seed_targets` payload (toggled-off excluded, handles normalized,
  user-added merged).
- `pullOwnVoiceCorpus` maps Apify items → corpus and surfaces a typed error when
  `APIFY_TOKEN` is absent.

Acceptance: `npm test` green, `npm run build` clean. A manual run of `/setup`
against the owner's profile produces a non-empty `voice_spec` + ≥1 `seed_target`,
making a real Pulse possible (validated under piece A).

## 8. Out of scope (explicit)

- Wiring X-algorithm rules into reply/Pulse drafting (piece **C**).
- Provisioning live Apify/OpenAI keys and running a real Pulse (piece **A**).
- Multi-user auth/onboarding, billing, or the "when someone pays" gating — this
  spec builds the single-user setup flow that those will later wrap.
- Posting integrations.

## 9. Open implementation questions (resolve in plan)

- Persist partial answers in `localStorage` vs `onboarding_answers` per step?
  (Lean localStorage for simplicity; flush to DB on finish.)
- Keep `profile-form.tsx` as an "advanced" path or remove from default nav?
- Exact `account_size` / `daily_capacity` → recommendation/cadence mappings
  (how capacity changes pulse count). Start simple, refine later.
