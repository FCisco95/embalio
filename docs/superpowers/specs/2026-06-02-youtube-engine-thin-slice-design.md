# Embalio YouTube Engine — Thin Vertical Slice (design spec)

**Date:** 2026-06-02
**Status:** Approved (design) — pending implementation plan
**Branch base:** `make-it-true`
**Canonical product plan:** `C:\Users\joao_\.claude\plans\for-this-idea-i-m-starry-salamander.md` (Part C governs this build)

This spec covers the **first thin vertical slice** of the YouTube Engine as a
feature of Embalio. It is deliberately scoped to one end-to-end path plus the
per-device recording profiles. Locked product decisions live in the canonical
plan and are **not** re-litigated here.

---

## 1. Goal & success criterion

Take a video from **"what's trending" → script → recorded take → published
(private) YouTube video → drafted X thread** inside Embalio, with the per-device
recording profile driving the Record Hub.

**Done when:** from `/studio`, a real topic board (HN signals + brain ranking)
lets the owner pick a topic → a real editable script (title + <15s hook +
teleprompter beats with per-line visual prompts) → Record Hub adapts to the
active device's recording profile and shows a teleprompter + beat checklist →
a recorded MP4 is uploaded to the real channel as **private** via the YouTube
Data API → a one-click handoff drafts an X thread into the existing sign-off
queue. Render is scaffolded (Shotstack deferred).

## 2. Locked inputs (from the canonical plan — do not change here)

- The YouTube Engine is a **feature of Embalio**, never a standalone SaaS.
- Real face front-loaded; **no AI-avatar**. Cloned-voice faceless Shorts deferred.
- Per-device recording profiles are a first-class, owner-requested feature.
- The "brain" (topic ranking + script authoring) is **creative judgment** that
  ultimately lives **outside this repo** as a Claude Code skill chain called via
  the Claude Agent SDK. This repo builds the **surface + plumbing** and wraps the
  brain behind a clean interface. Do not reimplement scriptwriting/ranking taste
  permanently in Embalio — slice 1 uses a local-`claude -p` implementation of the
  same interface so the UI is built against the real contract.

## 3. Architecture & shape decision

**Project-centric pipeline.** One `video_projects` row threads through stages:
`topic → script → record → publish → repurposed`. A single new **Studio**
section (`/studio`) renders a **stage rail** that reads/writes that row as it
advances.

**Why project-centric (decided):** a video is one artifact moving through linear
stages; the X section's per-route model fits independent streams, not a pipeline.
A stage rail keeps "where is this video" obvious and makes the script→record and
script→X-thread handoffs trivial. Alternative (separate `/topics`, `/script`, …
routes) rejected: more nav chrome, lost continuity.

**Navigation:** one new sidebar entry **"Studio"** (`/studio`) inside the `(app)`
group, following the existing "section + internal stages/tabs" idiom. UI/UX
details are delegated to the implementer.

## 4. Data model

Three new tables; reuse `drafts` for the X handoff. Migrations follow the
existing numbered convention in `supabase/migrations/` (next free numbers), and
`src/lib/supabase/types.ts` is regenerated to match.

### 4.1 `recording_profiles`
Per-device recording configuration, synced across machines via Supabase (the
existing sync backbone — same philosophy as the Obsidian-Git vault sync).

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `profile_id` | uuid fk → profiles | |
| `device_label` | text | e.g. "Home (Windows)", "Travel (Mac)" |
| `os` | text | "windows" \| "macos" |
| `monitors` | jsonb | `[{ resolution, role }]` |
| `capture_tool` | text | "OBS+Rapidemo" \| "OBS" |
| `mic` | text | nullable |
| `webcam` | text | nullable |
| `teleprompter_placement` | text | e.g. "top-center", "webcam-overlay" |
| `scene_presets` | jsonb | `string[]` of OBS scene names |
| `export_path` | text | where OBS writes takes (guidance only) |
| `sync_target` | text | nullable |
| `created_at` | timestamptz | default now() |

**Active-device detection:** a `localStorage` `deviceId` maps to a
`recording_profile.id`; a manual override dropdown lets the owner pick a profile
on any machine. First-run with no mapping → prompt to pick/create a profile.

**Seed:** Home (Windows, multi-screen, `OBS+Rapidemo`) and Travel (Mac, single
screen, `OBS`), inserted for the owner's profile via the migration or a seed
server action.

### 4.2 `video_projects`
The spine.

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `profile_id` | uuid fk → profiles | |
| `stage` | text | "topic"\|"script"\|"record"\|"publish"\|"repurposed" |
| `topic` | jsonb | a `RankedTopic` (see §5) once chosen, else null |
| `script` | jsonb | a `VideoScript` (see §5), editable, else null |
| `recording` | jsonb | `{ recording_profile_id, take_confirmed_at, notes }` |
| `publish` | jsonb | `{ youtube_video_id, url, privacy_status, published_at }` |
| `created_at` / `updated_at` | timestamptz | |

Stage transitions are validated by a pure function (testable; only legal
forward/back moves allowed).

### 4.3 `youtube_credentials`
OAuth tokens for `videos.insert`. **Service-role only** (mirrors the
research-briefings/service-role pattern); never read by anon/RLS paths.

| column | type | notes |
|---|---|---|
| `profile_id` | uuid pk/fk → profiles | one channel per profile in slice 1 |
| `refresh_token` | text | |
| `scope` | text | |
| `obtained_at` | timestamptz | |

### 4.4 Reuse `drafts`
The Repurpose→X handoff writes to the existing `drafts` table (no new table) so
threads surface in the existing Engage/Compose sign-off queue.

## 5. The "brain" boundary

A single swappable interface. Slice 1 implementation `LocalClaudeBrain` is backed
by the existing `generateStructured(zodSchema, prompt)` (`claude -p`) path so it
produces real output now; the implementation is later swapped for an
`AgentSdkBrain` calling the external skill chain with **zero UI change**.

```ts
interface TrendSignal {
  source: "hackernews"            // slice 1; "apify-x" | "github-trending" later
  id: string
  title: string
  url: string
  score?: number                  // upstream popularity (e.g. HN points)
  comments?: number
  createdAt?: string
}

interface RankedTopic {
  id: string
  title: string                   // working title
  angle: string                   // why this, for the vibe-coding-on-blockchain niche
  score: number                   // 0..100, brand-fit ranking
  rationale: string
  sourceRefs: string[]            // urls/ids from the signals
}

interface ScriptBeat {
  id: string
  say: string                     // teleprompter "say this" line
  visualPrompt: string            // on-screen element for this line
  estSeconds?: number
}

interface VideoScript {
  title: string                   // packaging-rule title
  hook: string                    // must pay off in the first 15s
  beats: ScriptBeat[]
}

interface BrainClient {
  rankTopics(req: {
    niche: string
    voiceSpec?: string
    signals: TrendSignal[]
    count?: number
  }): Promise<RankedTopic[]>

  writeScript(req: {
    topic: RankedTopic
    voiceSpec?: string
    targetDurationSec?: number
  }): Promise<VideoScript>
}
```

- `RankedTopic`, `VideoScript`, `ScriptBeat`, `TrendSignal` get Zod schemas in
  `src/lib/schemas.ts` (or a `studio/` schema module) and are validated through
  `generateStructured`'s retry-on-schema-error path.
- **Signals in slice 1:** `collectTrendSignals()` pulls from the **Hacker News
  Algolia API** (`https://hn.algolia.com/api/v1/search_by_date`, free, no key),
  normalized to `TrendSignal[]`. Apify-X and GitHub-trending are added later
  behind the same `TrendSignal` shape.
- The chosen topic is a **~30s human pick gate** (owner taps one topic on the
  board); ranking does not auto-advance.

## 6. YouTube publish (real, forced-private)

- Library: `googleapis`. One-time OAuth: a `/api/youtube/oauth/start` redirect +
  `/api/youtube/oauth/callback` route exchanges the auth code for a refresh
  token, stored in `youtube_credentials` (service-role).
- Publish panel: a **file picker for the recorded MP4** (a web app cannot read
  arbitrary local paths; the profile's `export_path` is shown as guidance only)
  + title/description prefilled from the script.
- Upload: resumable `videos.insert` with **`privacyStatus: 'private'` hardcoded**
  in slice 1. On success, write `youtube_video_id` + URL onto the project's
  `publish` jsonb and advance the stage.
- The forced-private constant is the single seam to relax later (public/scheduled).

## 7. Repurpose → X-thread handoff

`createXThreadFromVideo(projectId)` server action: loads the project's script +
published URL + the profile's voice spec, runs the existing voice/
`generateStructured` path to draft a thread, and writes the resulting rows into
the existing **`drafts`** table (so they appear in the Engage/Compose sign-off
queue). This cross-section payoff is a core reason the engine lives in Embalio.

## 8. Record Hub

Detect active device → resolve its `recording_profile` → render:
- a **teleprompter overlay** of `script.beats[].say`,
- a **checklist** of the beats,
- the profile's capture-tool / scene-preset / teleprompter-placement guidance,
- a **"take recorded" confirmation** that writes `recording.take_confirmed_at`
  and advances the stage.

Human-driven (the moat). **In-app capture is out of scope** — Record Hub
orchestrates external OBS and stores the take reference.

## 9. Slice boundary

**Real in slice 1:** Topic Board (HN signals + brain ranking), Script Studio
(real editable script JSON), Record Hub (profile-driven), Publish (real private
upload), Repurpose→X handoff.

**Scaffold-only:** Render panel + `render()` seam (Shotstack integration
deferred to slice 2).

**Deferred (not in slice 1):** Scoreboard/Retro analytics, Opus Clip Shorts,
cloned-voice path, multi-project management UI, Apify/GitHub trend signals,
public/scheduled publish.

## 10. Testing

Vitest, matching repo conventions (colocated `*.test.ts`, no live API calls):
- pure logic: `TrendSignal` normalization, brand-fit ordering, stage-transition
  validator, beat parsing, `deviceId → recording_profile` resolution, forced
  privacy constant.
- brain schemas: validate `RankedTopic` / `VideoScript` against fixture model
  output through `generateStructured`'s parse path.
- `BrainClient`, `googleapis`, and the HN fetch are mocked/injected.

## 11. Files (anticipated; finalized in the implementation plan)

- `supabase/migrations/00NN_recording_profiles.sql`, `…_video_projects.sql`,
  `…_youtube_credentials.sql`; regenerate `src/lib/supabase/types.ts`.
- `src/lib/studio/brain.ts` (`BrainClient`, `LocalClaudeBrain`),
  `src/lib/studio/signals.ts` (`collectTrendSignals`),
  `src/lib/studio/schemas.ts`, `src/lib/studio/stages.ts` (transition validator),
  `src/lib/studio/recording-profile.ts` (device resolution).
- `src/server/studio/*.ts` (topic board, script, record confirm, publish,
  repurpose handoff, recording-profile CRUD).
- `src/lib/youtube.ts` (googleapis wrapper, `withRetry`), OAuth routes under
  `src/app/api/youtube/oauth/*`.
- `src/app/(app)/studio/page.tsx` + stage-rail components under
  `src/components/studio/*`.
- Sidebar entry in `src/components/shell/sidebar.tsx`.

## 12. Open questions (non-blocking; tracked, not gating slice 1)

1. Channel handle / brand name for "Solo Dev Journey" (not needed to upload private).
2. Exact Organic metric for the eventual Scoreboard (deferred panel).
3. When to swap `LocalClaudeBrain` → `AgentSdkBrain` (after the external skill
   chain exists; interface already isolates this).
