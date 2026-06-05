# Session 8 (2026-06-05) — Teleprompter built, revamped live to subtitle mode

**Branch:** `feat/recording-cockpit` · 45 commits this session (`bac194f..d1ec19f`) · NOT pushed.
**State:** 348 tests pass / 1 skip · `tsc --noEmit` clean · eslint (React Compiler rules) clean.

## TL;DR

Executed the 12-task plan (`docs/superpowers/plans/2026-06-04-teleprompter-integration.md`)
via subagent-driven development (implementer → spec review → quality review per task; reviews
caught 5+ real bugs the plan missed). Owner then smoke-tested live and iterated the overlay
into a **subtitle-style product**: floating text only, one lock control, everything
mouse-drivable. Voice-follow runs end-to-end on CUDA but is **registered as a known issue**
— not reliable enough; research brief parked for later.

## What to do next (in order)

1. **Finish owner smoke test:**
   - OBS: add Display Capture AND Window Capture → overlay must appear in NEITHER.
   - Marker flow: panel **Start session** → advance chunks → **Stop & export** →
     `embalio_markers.edl` + `embalio_chapters.txt` land in Documents (or
     `EMBALIO_EXPORT_DIR`) → import `.edl` into DaVinci Resolve → project advances to Publish.
2. **Wrap the branch:** `superpowers:finishing-a-development-branch` — 45 commits, merge/PR
   to `main` (or owner's call). Branch not pushed to origin yet.
3. **Voice-follow (parked, task #17):** run the deep-research prompt in
   `docs/research/2026-06-05-voice-follow-feasibility-brief.md` BEFORE any code. Decision
   gate: credible <1 s architecture → build; else kill the feature, keep manual paging.

## Launch recipe (this Windows box)

```powershell
# Terminal 1
cd <repo>; npm run dev
# Terminal 2 (after "Ready")
cd <repo>\desktop
$env:EMBALIO_PYTHON = "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe"
npm start   # auto-detects :3000; spawns it if missing
```
Notes: bare `python` on PATH is 3.8 (too old for faster-whisper) — EMBALIO_PYTHON required
for voice. `EMBALIO_VOICE=off` skips the sidecar. PowerShell env vars persist per session —
a leftover `EMBALIO_VOICE=off` silently kills voice (cost us a debug cycle).

## What shipped (beyond the original plan)

- **Subtitle overlay** (`src/components/studio/cockpit.tsx`): no card/chrome — text with
  layered shadow over transparent page (html/body bg cleared in Electron; Next devtools
  badge hidden). Backdrop pill: `opacity` darkens a snug rgba pill, text always full
  strength. Locked: text + always-visible 🔒 (hover momentarily disables click-through via
  `overlay:set-ignore-mouse` + forward:true mousemove trick). Unlocked: strip
  🔓 A± ☰± 🎙 n/m ✕, text block = drag region, `width` resizes the actual Electron window
  (`overlay:resize`).
- **Control panel** (`src/components/studio/teleprompter-controls.tsx`): renders in Record
  Hub while overlay open (overlay-state IPC). Unlock/Lock · Close · Start session ·
  Stop & export · 🎙 Voice follow · text size / lines / backdrop / width ± ·
  Sentence/Paragraph · Mirror.
- **Manual script box** (`src/components/studio/manual-script-input.tsx` +
  `src/lib/studio/manual-script.ts`): textarea in Record Hub; replaces generated script on
  the teleprompter until cleared. **Enter = new chunk.** Synced via localStorage storage
  events (works Electron + browser tab, no IPC).
- **Paging model:** `lines` = pieces visible at once in BOTH modes (sentences within chunk /
  chunks). next/prev advance by a full page; tail never re-shows already-seen text.
- **Studio navigation fixes:** project switcher dropdown (`studio-flow.tsx`) and clickable
  stage chips — `goBackToStage` server action (backward-only; forward stays gated).
  `isEarlierStage` in `src/lib/studio/stages.ts`.
- **Removed dead UI (owner request):** Shotstack render placeholder panel, height ± controls,
  preset save/recall 1-3 (whole feature incl. store plumbing — last-layout auto-restore stays).
- **Hydration-safe layout load:** `useSyncExternalStore` gate + render-phase adjust (repo
  lint forbids setState-in-effect). Stale persisted layouts backfilled via
  `clampLayout({ ...DEFAULT_LAYOUT, ...stored })`.

## Voice-follow: known issue (parked)

Pipeline verified: mic → `desktop/sidecar/whisper_stream.py` (faster-whisper small.en,
CUDA float16, CPU int8 fallback, pip CUDA DLL dirs prepended to PATH — `add_dll_directory`
alone insufficient for ctranslate2) → ws://127.0.0.1:8765 → `voicefollow.ts` follower.
Follower improved: LOOK_AHEAD 6, 2-word resync (horizon 40), `seek()` re-anchors on manual
nav, display only moves on real progress. Still: stalls/lag (~1–2 s windows) → owner
verdict NOT usable. Full brief + runnable research prompt:
`docs/research/2026-06-05-voice-follow-feasibility-brief.md`.

## Notable debugging war stories (don't re-learn these)

- "Jest worker encountered 2 child process exceptions" wedging every route = Next's
  TypeScript type-check child died (likely commit-charge exhaustion during OBS+Electron
  session); permanent until server restart. Dev log: `.next/dev/logs/next-development.log`.
- Overlay can't be screenshotted BY DESIGN (capture exclusion) — errors rendering inside it
  are invisible to screenshots; read the dev log instead.
- Hydration mismatch = persisted layout read during first client render; fixed via
  post-hydration load.
- electron-store IPC: sync `store:get-sync` (sendSync), guarded handlers,
  `accessPropertiesByDotNotation: false`.

## Suggested skills

- `handoff-memory` — resume context.
- `superpowers:finishing-a-development-branch` — wrap `feat/recording-cockpit`.
- `deep-research` — voice-follow brief (only when owner picks it up; task #17).
- `superpowers:subagent-driven-development` — worked well; reviews caught real bugs
  (chunking digit corruption, Windows process-tree orphans, interactive-state desync,
  media-track leak, stale-layout blank render).
