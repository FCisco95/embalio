# Embalio — Engagement Engine + Growth-Plan Quiz (Design Spec)

**Date:** 2026-06-01
**Status:** Draft (brainstorm) — awaiting owner review before implementation plan
**Branch target:** new branch off `make-it-true` (e.g. `feat/engagement-engine`)
**Supersedes/extends:** `docs/superpowers/specs/2026-05-31-onboarding-quiz-design.md`
(that spec built the quiz as a data-collection form; this one reframes the quiz as
the **control panel for a real engagement engine**).
**Grounding research:** `docs/superpowers/notes/2026-06-01-x-growth-playbook-research.md`
(X ranking weights, reply playbook, per-platform rules — all sourced).

---

## 1. Why this exists — the reframe

**The product is not the quiz. The product is the *engagement* — and its quality is
everything.** A generic "great post 🔥" reply is AI slop and would sink Embalio.

Embalio is a **coach, not an autopilot.** It hands the owner a personalized
**growth formula** and then, day to day, does the "should I engage with this? what do
I say?" thinking for them — so a busy operator can grow one (later many) X accounts
**plug-and-play**, by staying consistent with the right moves: engaging the right
posts, posting the right amount at the right quality, adapting to how the audience
reacts. Human-in-the-loop throughout (nothing auto-posts in V1).

There is **no universal growth formula** — a Protocol grows differently than a solo
Dev than a Founder than a Trader. So the setup quiz exists to **capture which formula
this account needs**, and every answer becomes a **knob** on the engagement engine.

## 2. The core mechanic (what every draft optimizes for)

X open-sourced its ranker and disclosed its engagement weights (Sept 2025). Relative
to a Like (1×):

- **A reply the *author replies back to* ≈ 150×** ← the supreme signal
- Your reply ≈ 27× · Profile-click→engage ≈ 24× (the follow path) · Bookmark / 2-min dwell ≈ 20×
- Repost ≈ 2× · Like ≈ 1×

**Design law:** the engine drafts replies **engineered to make the original poster
respond**, and posts engineered for **replies + bookmarks + dwell** — never for likes.
Replies are the growth engine (~70% of effort vs 30% original while small).

## 3. Current state (audit) — where it's generic today

(Full detail in the audit; key facts:)

- **Reply drafting** (`src/lib/drafting.ts` → `buildReplyPrompt` in `voice-prompt.ts`)
  receives **only voice + the target tweet** and says "add genuine value" (undefined).
- **`buildAlgorithmRulesBlock(format)`** is **format-aware only** and is currently a
  **stub** (the 1 failing test). No platform/goal/tier/scenario awareness.
- **Scoring** (`src/lib/scoring.ts`): fixed weights `relevance .5 / velocity .3 /
  recency .2`; no author-size, goal, scenario, or platform input.
- **Quiz collects `accountSize`, `capacity`, `goal`** but they are **not wired** into
  scoring or drafting.
- A richer reply pipeline exists in `src/server/engage.ts` (`buildReplyFilterPrompt`,
  `buildReplyDraftPrompt`) with decent anti-slop instincts but no goal/scenario/tier
  awareness.

**Good news:** ~10 surgical seams exist; this is parameter-injection, not a rewrite.

## 4. The Engagement Engine — four skill modules

Each module is an isolated unit with a clear input→output contract, composed at draft
time. All are **parameterized by the quiz-derived profile** (see §6).

### 4.1 Targeting skill — *which* posts to engage
Upgrades `compositeScore` + the candidate filter with researched rules:
- **Author size 5–20× the owner's follower count** (mega buries you; tiny has no
  audience to borrow). Requires capturing author follower count (see §7).
- **Recency**: strongly favor posts < 30 min old (ideally < 5 min); decay fast.
- **Reply count < ~20** (stay in the visible top replies).
- **On-pillar relevance** (existing embedding cosine).
- **Goal re-weighting**: leads → question/DM-able posts; authority → depth/technical;
  reach → larger *rising* posts; followers → peer-tier relationship posts.
- **Volume guardrail** from capacity: ~15–20 quality replies/day target, hard cap < 50.

**Contract:** `scoreCandidate(candidate, authorMeta, profileKnobs) → Scores` and a
filter that returns the top-N engage-worthy candidates with a detected `scenario`.

### 4.2 Reply-craft skill — *how* to engage (the anti-slop core)
- **Detect scenario** from the target post: `supportive | contrarian | witty |
  technical | question`.
- Apply the matching recipe (from research; see note doc), always **writing for the
  author's reply-back**:
  - *supportive*: affirm in half a line + add a fact/mechanism they lacked.
  - *contrarian*: disagree with evidence, stay warm (never dunk — toxicity is flagged).
  - *witty*: one sharp on-topic line that reframes the post.
  - *technical*: the precise practitioner detail/gotcha/number.
  - *question*: a specific question proving you read it, that the author enjoys answering.
- **Hard slop-ban**: "great post", "this 🔥", "well said", bare emoji, restating the OP.
- **Tuned by**: archetype (what "value" means for a dev vs founder vs trader), voice
  spec, goal, and the owner's do/don'ts. Returns `{ reply, scenario, skip }`.

### 4.3 Post-craft skill — create-a-post
- **Hot-topic scan** (reuse existing research path) → candidate angles.
- **Hook** = line 1: curiosity gap + specific payoff (templates in the note doc).
- **Format selection**: single text / 5–10-tweet thread (only with a real sequence) /
  screenshot; **link-in-reply** (never in the main post).
- Built for replies + bookmarks + dwell; ends on a real question, not a CTA.
- Cadence guidance (3–5/day; Tue–Thu 9am–3pm) surfaced as suggestions, not enforced.

### 4.4 Platform skill
- **X**: fully defined and **active** in V1.
- **LinkedIn / YouTube**: strategies defined from research (LinkedIn = long substantive
  comments + consistency, no bait; YouTube = fast on-topic comments + pinned prompts +
  selective hearts) and **stored** from the quiz, but **not acted on** in V1
  (no LinkedIn/YouTube data source yet). Structure-ready for later activation.

## 5. The Quiz — the engine's control panel

Tap-first, one question per screen, short explanation above each, **sectioned progress
with category labels** (Deepstash-style), **Core** (everyone) vs **Optional**
(deepens the formula, skippable), and **reflective interstitials** that mirror the
answer back as *a piece of the plan forming* ("Goal: reach — so I'll prioritize larger
*rising* posts and write for the repost-and-reply, not the like"). Resumable.
Dynamic = deterministic branching on the **archetype** answer (no AI-generated quiz
in V1; that's a later evolution).

**Chapters & questions** (each maps to an engine knob; 🖼️ = image placeholder to
generate later — no logo yet):

1. **You** — 🖼️*welcome/mascot* — archetype (keystone, branches everything) ·
   zone-of-genius · *(opt)* why you're really doing this (motive).
2. **Goal** — 🖼️*summit/roadmap* — 90-day win + metric · account stage · *(opt)* intensity.
3. **Niche & edge** — 🖼️*standout node* — pillars · why-follow-YOU (angle) · *(opt)* audience.
4. **Channels & superpowers** — 🖼️*toolkit* — platforms (X acts; others stored) ·
   formats · *(opt)* show face? · *(opt)* can you make visuals / use AI? · *(opt)* unfair advantages.
5. **Voice** — 🖼️*fingerprint speech bubble* — **what should your voice sound like?**
   (the reframed lead question) · learn-from source (pull/paste/tags) · *(opt)* never-do guardrails.
6. **Inspirations & rivals** — 🖼️*constellation* — accounts to grow like (→ seed_targets +
   voice modeling) · *(opt)* who to engage now.
7. **Rhythm & commitment** — 🖼️*steady heartbeat* — time/day → cadence · *(opt)* consistency ·
   commitment beat ("show up on slow days?").

**Knob mapping:** archetype→value/tone + favored scenarios; goal→scoring weights +
reply objective + CTA style; account stage→the 5–20× target band; capacity→daily reply
volume; platforms→active skills; formats/face/AI→post types + visual suggestions;
voice + don'ts→voice system + slop guardrails; inspirations→seed_targets.

**Climax:** a "**We're crafting your growth plan…**" screen — animated multi-stage bars
(Reading your voice ✓ · Finding accounts… · Setting your rhythm…) that fills the *real*
latency (Apify pull + `synthesizePersona` + recommend), with an optional bonus question
during the wait — then the **Growth Plan reveal** (§6 below is the plan).

**Visual fidelity:** every screen (quiz, Scan→Engage, Create-a-post, Growth Plan)
reuses the existing **Dispatch design system** — `Card`/`CardTitle`, `BrandAvatar`,
`ScorePill`/`ScoreBar` (the targeting fit badges), `StyledSelect`, `Skeleton`, and the
brand tokens — not bespoke styling. Brainstorm mockups are **structural only**; the
build must match the app's look. (Logo/colors land later; reuse current tokens until then.)

## 6. The Growth Plan artifact (the output)

A visible, saved plan shown at the end and living on the dashboard; the engine runs
against it. Sections:
1. **Your voice** (the spec) · 2. **Your pillars + angle** · 3. **Who to watch**
(accounts + a one-line *why this, for you*) · 4. **Your rhythm** (concrete weekly
cadence from capacity) · 5. **Your north-star** (goal + metric) · 6. **What Embalio
does for you** (personalized promise) · 7. *(opt)* **Your first moves** (2–3 starting actions).
🖼️*plan hero banner.*

## 7. Data model changes

No engine-blocking migration for what already exists; **new** columns/fields:
- `profiles`: `account_size`, `daily_capacity`, `reply_playbook` (do/don'ts text),
  `platforms` (text[]), `formats` (text[]), `show_face`, `creative_tools` (text[]),
  `advantages` (text[]), `motive`, `angle`. (Several can ride in `onboarding_answers`
  jsonb to avoid migration; persist the *engine-critical* ones — goal, account_size,
  capacity, reply_playbook — as columns for query/use.)
- `candidates`: add `author_follower_count` (drives the 5–20× rule) and `reply_count`
  (the <20 rule) to `metrics_snapshot`, plus a detected `scenario`.
- `drafts`: add `engagement_scenario` (track which recipe produced it).
- Apify field-mapping (`src/lib/apify.ts`) must capture author follower count + reply
  count if the live actor provides them (verify against live output).

## 8. V1 scope & cut lines

**In:** X engagement engine (all 4 skills, X active) wired to the quiz knobs; the quiz
+ Growth Plan; the two flows (Scan→ready replies, Create-a-post); local, **single
account**, perfected. Replaces the `buildAlgorithmRulesBlock` stub (fixes the failing test).
**Out (later):** LinkedIn/YouTube *acting*; multiple accounts; **auto-engage on
high-score** (stays human-in-the-loop); paid cloud generation; posting integrations.

## 9. Build sequence (phased — each independently shippable/testable)

1. **Engine knobs + data**: profile columns/migration, capture author followers/reply
   count, wire `goal`/`account_size`/`capacity` through. (Unblocks everything.)
2. **Targeting skill**: scoring upgrade + filter (pure functions, unit-tested).
3. **Reply-craft skill**: scenario detection + recipes; replace the stub. (Pure
   prompt-builders, unit-tested; golden-prompt snapshots.)
4. **Scan→Engage flow** UX: "here are N posts + a ready reply each → fire off / skip".
5. **Post-craft skill + Create-a-post flow.**
6. **Quiz redesign** (chapters, interstitials, crafting moment) + **Growth Plan** reveal.
7. **Platform skill** scaffolding (X active; LinkedIn/YouTube defined-inactive).

## 10. Testing strategy

Pure-function/unit (Vitest), network mocked: scoring with the 5–20×/recency/reply-count
rules; scenario detection; each reply recipe via **golden-prompt snapshots** (assert the
slop-ban + author-reply objective + scenario recipe are present); STEPS config integrity;
answers→knobs mapping; `needsSetup`; curation→seed_targets. Acceptance: `npm test` green
(no `RUN_RLS_INTEGRATION`), `npm run build` clean, and a live single-account run that
produces non-slop, scenario-appropriate replies for real surfaced posts.

## 11. Decisions made for review (redline these)

- Quiz length: ~10 Core + ~9 Optional across 7 chapters (Optional = skippable).
- `reply_playbook` (do/don'ts) is a **first-class** quiz input feeding the guardrails.
- Scenario set fixed at 5 (supportive/contrarian/witty/technical/question) for V1.
- "First moves" (plan §7) included.
- Some capability fields stored in `onboarding_answers` jsonb (no column) until a
  consumer exists — capture-now, wire-later.

## 12. Out of scope (explicit)

Auto-posting; auto-engage; multi-account; LinkedIn/YouTube acting; billing/auth/RLS
multi-tenant (the security workstream wraps this later); X API (still Apify).

## 13. References
- Research grounding: `docs/superpowers/notes/2026-06-01-x-growth-playbook-research.md`
- Prior quiz spec (superseded): `docs/superpowers/specs/2026-05-31-onboarding-quiz-design.md`
- North star: `docs/NORTH-STAR.md`
