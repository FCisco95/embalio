# Handoff snapshot — Teleprompter Integration planning (2026-06-04)

**Branch:** `feat/recording-cockpit` · **Type:** planning session (NO implementation code by request)

## TL;DR

Ran a full brainstorming → writing-plans session to turn the Odysseus PowerShell
teleprompter prototype into a native Embalio feature. Output: an approved **design spec**
+ a 12-task **implementation plan**, both committed to the repo and mirrored into the vault.
Also corrected a stack lie that was spread across five vault docs (Embalio is **not** Tauri).
**Nothing was implemented** — the next session builds from the plan.

## What to do next

1. Build the teleprompter integration via **subagent-driven-development** on
   `feat/recording-cockpit`, working through `docs/superpowers/plans/2026-06-04-teleprompter-integration.md`
   (12 tasks / 6 slices, TDD on pure modules, manual smoke on Electron/media).
2. End with the owner-gated Windows smoke test (plan Task 12): invisible in OBS, global hotkeys
   while OBS focused, presets survive relaunch, EDL imports into DaVinci Resolve.
3. Keep the PowerShell overlay (`<vault>/…/odysseus-video/Teleprompter Overlay.ps1`) as the
   Windows daily-driver until this ships.

## Artifacts produced

- **Design spec:** `docs/superpowers/specs/2026-06-04-teleprompter-integration-design.md` (commit `5387dde`)
- **Plan:** `docs/superpowers/plans/2026-06-04-teleprompter-integration.md` (commit `180cf4e`)
- Vault mirrors: `10 - PROJECTS/Embalio/specs/` + `plans/` (same filenames).
- Vault task: `TASKS/items/Task — Embalio Teleprompter Integration.md` + BACKLOG.md entry +
  pointers in `Embalio — YouTube Engine.md`.

## Decisions locked (see spec §3 for full table)

- **Stack: Electron**, not Tauri. App is Next.js web + `/desktop` Electron overlay + Python Whisper
  sidecar. Tauri parked unless Embalio becomes a packaged product with native capture.
- **One-click = Option A:** Electron becomes Embalio's shell (main window loads web UI; main process
  supervises the Next server + sidecar; Record-stage button opens the invisible overlay via IPC).
- **Consume structured `VideoScript.beats` directly** (no HTML parse). **Separate invisible window**,
  not an OBS browser-source (which would burn the prompter into the recording).
- **Presets: local `electron-store`** (overlay is Windows-only → sync has little value yet).
- **Hotkeys:** laptop-safe defaults now, rebindable post-MVP.
- **Scope:** one-click invisible teleprompter (cockpit foundation + PS1 ergonomics: chunking,
  live-adjust, named presets, mirror) + a light guided-shoot gate (checklist + 10s audio/framing test).
  **Parked:** livestream, OBS-websocket orchestration, batch-shoot, in-app capture, macOS overlay,
  installer, synced presets.

## Vault cleanup (the "truth" pass)

Five vault docs claimed "Stack resolved 2026-06-02: Tauri/React, like Lectus" — never built.
Corrected `Embalio — YouTube Engine.md`, `_hub/Embalio — Home.md`, `_hub/Embalio — Next Steps.md`,
`plans/2026-06-02-youtube-engine-skill-chain.md`, and `specs/Embalio — Teleprompter (Feature Spec).md`
(now `status: superseded-by-design`). Left `Video Ideas Backlog` line 47 alone — that Tauri ref is
correctly about **Lectus**, not Embalio. Vault edits are **not committed** (vault ≠ this repo); rely on
Obsidian-Git sync. Also added memory `embalio-stack-truth.md`.

## Build map (from the plan)

New pure modules (TDD): `src/lib/studio/chunking.ts`, `teleprompter-layout.ts`, `teleprompter-store.ts`,
`audio-meter.ts`, `preshoot-checklist.ts`. New component: `src/components/studio/preshoot-gate.tsx`.
Modified: `src/components/studio/cockpit.tsx` (live-adjust + presets + chunking), `record-hub.tsx`
(one-click + gate), `desktop/main.js` (main window + `overlay:open` IPC + Next supervision +
electron-store IPC), `desktop/preload.js`, `desktop/package.json` (+`electron-store`).

## Suggested skills (next session)

- **superpowers:subagent-driven-development** — execute the plan task-by-task with two-stage review.
- **superpowers:executing-plans** — alternative inline batch execution if preferred.
- **handoff** — refresh `docs/HANDOFF.md` at the end of the build session.

## Unverified

- The plan's Electron code (main-window + Next-server supervision via `spawn`, electron-store sync IPC)
  is designed, not run — verify on Windows during Task 12.
- `@testing-library/react`/jsdom may not yet be dev-deps; plan Task 7 notes adding them if absent.
