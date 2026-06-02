# Embalio YouTube Brain v2 — Channel Playbook (design spec)

**Date:** 2026-06-03
**Status:** Approved (design) — pending implementation plan
**Branch base:** `make-it-true`
**Canonical product plan:** `C:\Users\joao_\.claude\plans\for-this-idea-i-m-starry-salamander.md` (Part B/C govern the brain)
**Predecessor:** `docs/superpowers/specs/2026-06-02-youtube-engine-thin-slice-design.md` (slice 1 — the pipeline + the `BrainClient` seam this spec upgrades)

This spec covers the **first slice of the "brain done right"**: making the YouTube
Engine's judgment encode real, **sourced YouTube-algorithm expertise** and produce a
**strategic Channel Playbook** that frames every topic and script — so the engine doesn't
just make videos *faster*, it points the owner down the *right* path for the brand.

It is deliberately scoped. The brain's full vision is six pieces:
① Algorithm Brief · ② Channel Playbook · ③ playbook-framed topic ranking + scripts ·
④ `AgentSdkBrain` + external Claude Code skill chain · ⑤ broader trend signals (Apify-X,
GitHub) · ⑥ scoreboard analytics. **This slice builds ①+②+③.** ④–⑥ are separate later specs.

---

## 1. Goal & success criterion

Encode current YouTube-algorithm best practices as a **live-researched, cached, sourced
knowledge brief**; synthesize that brief with the brand into a **persisted Channel
Playbook** (the strategic "path"); and make **topic ranking and script writing both derive
from the Playbook**, all behind the existing `BrainClient` interface.

**Done when:** from `/studio`, the owner can generate a Channel Playbook → the brain runs
live research into YT best practices (cached, with visible sources) → synthesizes a Playbook
(positioning, dual north-star, pillars, packaging formulas, retention rules, concrete next
moves) grounded in `profile.niche_description` + `voiceSpec` → the Playbook renders in a
collapsible panel atop `/studio` → and topic scans + script generation visibly reflect the
Playbook (topics scored for playbook-fit; scripts follow the researched packaging/retention
rules). The brain still works with no Playbook (graceful degradation to slice-1 behavior).

## 2. Locked inputs (decided in brainstorming — do not re-litigate)

- **"Both" path:** the Channel Playbook frames the outputs — topic ranking and scripts are
  instances of the strategy, not independent generators.
- **Expertise is live-researched, then cached** (the repo's `runWeeklyBriefing` pattern):
  research is current and **sourced/auditable**, but topic/script calls stay fast and
  testable. Default freshness window **7 days**; manual "refresh research" bypasses it.
- **Two layers, not one:** the Algorithm Brief (general, refreshable, sourced) is separate
  from the Channel Playbook (brand-specific synthesis). Re-researching never rewrites
  strategy; strategy changes never force re-research.
- **Brain stays `LocalClaudeBrain`** (`claude -p`). The optional `playbook` added to the
  brain interface is the swap seam for the future `AgentSdkBrain` — zero UI/server change.
- **Judgment vs plumbing split:** research prompt, playbook synthesis, and framed
  ranking/scripting prompts are **judgment** → live in the `studio` brain modules and flow
  through `BrainClient`. Caching, persistence, and the freshness check are **plumbing** →
  live in `src/server/studio/`.

## 3. Architecture & data flow

Two-layer knowledge, then framed outputs:

```
            ┌─ live web research (claude -p, WebSearch/WebFetch, cached) ─┐
            ▼                                                            │
   ① ALGORITHM BRIEF  ── current YT best practices, WITH SOURCES
            │           (packaging/CTR, first-15s retention, formats,
            │            cadence, "inauthentic/mass-produced" demotion)
            ▼
   ② CHANNEL PLAYBOOK ── brand (niche_description + voiceSpec + any
            │            existing north-star/growth context) × the Brief
            │            = the strategic path. The dual north-star is a
            │            SYNTHESIZED output, not a stored input.
            ▼
   ③ topic ranking  +  script writing  ── both receive the Playbook
```

**Data flow:** open `/studio` → if no Playbook, offer "Generate Channel Playbook" → that
runs the Brief (researches only if stale, else reuses cache) → synthesizes + persists the
Playbook → subsequent topic scans and script generation pass the Playbook into the brain so
outputs are strategy-shaped.

**Brain-boundary integrity:** `rankTopics`/`writeScript` gain an optional `playbook`
argument — the *entire* `BrainClient` change. `LocalClaudeBrain` now and `AgentSdkBrain`
later both consume it identically.

## 4. Data model

Migrations follow the numbered convention; `src/lib/supabase/types.ts` is hand-reflected to
match. **Not applied to the live DB until owner-gated** (same discipline as slice 1).

### 4.1 `algorithm_briefs` (migration `0012`)
RLS **on**; service-role path only (mirrors `youtube_credentials`/`research_briefings`).

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `profile_id` | uuid fk → profiles | |
| `brief` | jsonb | an `AlgorithmBrief` (see §5) |
| `researched_at` | timestamptz | freshness = age of the latest row for the profile |
| `created_at` | timestamptz | default now() |

A new row is inserted per research run (keeps an **audit trail of sources**). Freshness is
computed from the most recent `researched_at`.

### 4.2 `profiles.channel_playbook jsonb` (migration `0013`, nullable)
Mirrors the existing `profiles.growth_plan` jsonb pattern exactly. Holds a `ChannelPlaybook`.

## 5. Schemas (Zod, in `src/lib/studio/schemas.ts`)

Both validated through `generateStructured`'s retry-on-schema-error parse path.

```ts
AlgorithmBrief = {
  packaging:    string[]   // title/thumbnail/CTR rules (min 1)
  retention:    string[]   // first-15s + pacing rules (min 1)
  formats:      string[]   // formats/series winning in-niche
  cadence:      string
  authenticity: string[]   // how to dodge the "inauthentic/mass-produced" demotion
  summary:      string
  sources:      { title: string, url: string }[]   // provenance
}

ChannelPlaybook = {
  positioning: string
  northStar:   { devBrand: string, organic: string }   // dual scoreboard, strategic TEXT only
  pillars:     { name: string, why: string }[]         // 1-6 pillars/series
  packagingFormulas: string[]   // title patterns to use (min 1)
  retentionRules:    string[]   // applied to every script (min 1)
  cadence:     string
  nextMoves:   string[]         // concrete what-to-make-next = "the path" (min 1)
  briefResearchedAt?: string    // provenance: which brief informed this
}
```

**Interface extension (single seam):** `RankRequest` and `ScriptRequest` each gain
`playbook?: ChannelPlaybook`. No other `BrainClient` change.

## 6. Generation (reuses existing mechanisms)

- **Brief:** `generateStructured(AlgorithmBrief, buildBriefPrompt(niche), { research: true,
  attempts: 3 })`. `research: true` flips on WebSearch/WebFetch (existing `buildClaudeArgs`
  path), so the call researches live **and** returns structured JSON. The prompt asks for
  *current* (2026) best practices and requires real sources.
- **Playbook:** `generateStructured(ChannelPlaybook, buildPlaybookPrompt(brand, brief),
  { attempts: 4 })` — uses the `attempts` budget added in `fix(studio)` `eddc740`, since the
  multi-field schema is constraint-heavy. Persisted to `profiles.channel_playbook`.
- **Caching:** `runAlgorithmBrief(profileId, { freshnessDays: 7 })` mirrors
  `runWeeklyBriefing` — read latest brief, reuse if within window, else run the research
  callback and insert. Idempotent; concurrency-safe.

**Prompt builders** (judgment → brain layer, in `src/lib/studio/brain.ts` or a sibling
`brain-prompts` module): `buildBriefPrompt(niche)`, `buildPlaybookPrompt(brand, brief)`, and
the extended `buildRankPrompt` / `buildScriptPrompt` (weave the Playbook's positioning,
pillars, packaging formulas, and retention rules; score topics by playbook-fit).

## 7. UI surface (`/studio`)

A **collapsible Channel Playbook panel** atop the stage rail (design-system + existing
`components/studio/*` idiom; implementer has layout latitude):

- **Content:** positioning · dual north-star · pillars · packaging formulas · the
  **next-moves** list (the path).
- **Provenance:** "Researched {date} · {N} sources" with the brief's source links expandable.
- **Empty state:** "Generate your Channel Playbook" CTA.
- **Two actions:** "Refresh playbook" (re-synthesize from current brand + brief) and "Refresh
  research" (force a fresh Algorithm Brief, bypassing the 7-day window).
- **Topic board (light touch):** ranked topics may show a "fits: {pillar}" tag — optional.

## 8. Error handling (must not regress the slice-1 pipeline)

- **Research fails** (flaky web research or exhausted attempts): fall back to the most recent
  cached brief **even if stale**, surfacing "research is N days old (refresh failed)". If no
  brief exists at all, Playbook generation surfaces a clear toast and writes **nothing
  partial**.
- **Playbook generation fails:** toast "couldn't build the playbook — try again"; no partial
  persist.
- **No playbook yet:** `rankTopics`/`writeScript` degrade to *exactly* slice-1 behavior — the
  `playbook` arg is optional context, so the upgrade cannot regress the working pipeline.
- **Cache concurrency:** reuse `runWeeklyBriefing`'s idempotent upsert/short-circuit pattern.

## 9. Testing (vitest, colocated `*.test.ts`, no live API calls)

- **Brief:** `AlgorithmBrief` schema parse via `generateStructured`; cache logic — returns
  cached when fresh, researches when stale (injected research fn + injected clock);
  fallback-to-stale on research failure.
- **Playbook:** `ChannelPlaybook` schema parse; `buildPlaybookPrompt` includes brand + brief
  fields; `generateChannelPlaybook` persists and handles a null result (no partial write).
- **Brain framing:** `buildRankPrompt` / `buildScriptPrompt` weave the Playbook when present
  and **omit it cleanly when absent** (the degradation guarantee); ranking prompt instructs
  scoring by playbook-fit.
- `BrainClient`, `googleapis`, `generateStructured`, web research, and the HN fetch are
  mocked or injected.

## 10. Files (anticipated; finalized in the implementation plan)

- `supabase/migrations/0012_algorithm_briefs.sql`, `0013_profiles_channel_playbook.sql`;
  regenerate `src/lib/supabase/types.ts`.
- `src/lib/studio/schemas.ts` (+ `AlgorithmBrief`, `ChannelPlaybook`; extend `RankRequest` /
  `ScriptRequest`).
- `src/lib/studio/brain.ts` (+ `buildBriefPrompt`, `buildPlaybookPrompt`; extend
  `buildRankPrompt` / `buildScriptPrompt` and the `LocalClaudeBrain` methods to thread the
  playbook).
- `src/server/studio/algorithm-brief.ts` (`getAlgorithmBrief`, `runAlgorithmBrief`),
  `src/server/studio/playbook.ts` (`getChannelPlaybook`, `generateChannelPlaybook`).
- `src/components/studio/playbook-panel.tsx`; wire into `src/app/(app)/studio/page.tsx` +
  `studio-flow.tsx`; pass the playbook into the topic/script server actions.

## 11. Scope boundary

**In slice 1:** Algorithm Brief (research + cache), Channel Playbook (generate + persist +
Studio panel), playbook-framed `rankTopics` + `writeScript`, migrations + `types.ts`, tests.

**Deferred:** `AgentSdkBrain` + external Claude Code skill chain · Apify-X/GitHub trend
signals · scoreboard analytics · auto-refresh cron · dashboard/`/plan`-style surfacing. The
dual north-star is **strategic text only** (no live analytics pull). Brain stays
`LocalClaudeBrain`; the optional-`playbook` interface is the swap seam.

## 12. Open questions (non-blocking; tracked, not gating)

1. Channel handle / brand name for "Solo Dev Journey" (only matters once the Playbook copy
   wants a concrete brand name; placeholder until then).
2. Exact Organic on-chain metric to stake (the dual north-star's `organic` field is free text
   for now; firms up when the scoreboard analytics slice lands).
3. When to swap `LocalClaudeBrain` → `AgentSdkBrain` (after the external skill chain exists;
   the `playbook` interface already isolates it).
