# Teleprompter Subtitle Mode — Design

**Date:** 2026-06-05 · **Status:** approved by owner (live iteration during smoke test)
**Supersedes the overlay chrome** of `2026-06-04-teleprompter-integration-design.md` §5/§7 (the
shell, IPC, presets, chunking, and control-panel architecture all stand).

## Why

Owner smoke-test feedback on the shipped cockpit overlay: it reads as a dark rectangular
window — status bar, buttons, black card — when what he wants is the PowerShell prototype's
feel: **floating text over the desktop, nothing else** ("like iPhone subtitles"). One control
on the window: lock/unlock. Everything else out of sight.

## Design

### Locked (recording) — default
- **Text only.** No background card, no status row, no buttons, no window affordances.
  White text with a layered dark text-shadow for readability over any desktop.
- One faint **🔒 icon** (corner of the text block). The window is click-through
  (`setIgnoreMouseEvents(true, {forward: true})`); `forward: true` keeps mousemove events
  flowing, so hovering the icon momentarily disables ignore (renderer → `overlay:set-ignore-mouse`)
  and the icon becomes clickable. Click → unlock (existing `toggleInteractive` round-trip).
  Leaving the icon (or unlocking) restores click-through.
- The Next.js dev-tools badge is hidden in the Electron overlay
  (`nextjs-portal { display: none }`, injected only when the bridge is present).

### Unlocked (adjusting)
- Same floating text plus one minimal strip: **🔓 · A− A+ · ☰− ☰+ · ✕** (lock, text size,
  sentences shown, close) and a tiny beat counter. Text block is the drag region
  (`-webkit-app-region: drag`); strip opts out.
- Everything else — opacity, width/height, mirror, mode, presets, **Start session**,
  **Stop & export** — lives in the main-window control panel (`teleprompter-controls.tsx`),
  which gains the two session buttons (`session-start` / `session-export` actions over the
  existing `overlay:control` channel). Hotkeys unchanged (Ctrl+→/← nav, Ctrl+M mark,
  Ctrl+Space voice, Ctrl+I lock, interactive-mode adjust keys).
- Content cues stay in the text block (they are content, not chrome): ▸do, ⚡fx, and the
  dim "next →" preview.

### Hydration-safe persisted layout (bug fix folded in)
Reading the persisted layout during the first client render caused a hydration mismatch
(server renders defaults). Fix: `useSyncExternalStore`-based hydration gate + React's
render-phase "adjust state" pattern to apply the stored layout exactly once after hydration
(lint-clean — the repo's React Compiler rules reject setState-in-effect). The persist effect
is gated until the load has happened so defaults never clobber the stored layout.

### State machine (ignore-mouse ownership)
- locked + not hovering 🔒 → ignore=true (forward)
- locked + hovering 🔒 → ignore=false (renderer-requested, transient)
- unlocked → ignore=false, focusable (owned by main's `toggleInteractive`, as today)
- Renderer only sends hover requests while locked; main ignores `overlay:set-ignore-mouse`
  when interactive, and re-asserts the canonical flags on every toggle. Overlay close resets all.

## Components touched
- `src/components/studio/cockpit.tsx` — render rework (subtitle look, lock icon, strip),
  hydration fix, badge hide, `session-start`/`session-export` actions.
- `src/components/studio/teleprompter-controls.tsx` — Start session / Stop & export buttons.
- `desktop/main.js` — `overlay:set-ignore-mouse` IPC (guarded: only honored while locked).
- `desktop/preload.js` — `setIgnoreMouse(ignore)` bridge method.
- `src/components/studio/cockpit.test.tsx` — adapt render assertions; cover locked
  (text + lock icon only) vs unlocked (strip present) rendering.
- `desktop/README.md` — controls section.

## Non-goals (unchanged)
Voice-follow UX revamp (F8/F9-style custom hotkeys, "press play and it follows" onboarding)
is the next design conversation, not this change. Window-position presets remain unwired.

## Testing
Pure logic is already covered (chunking/layout/store). This change is mostly chrome:
component render tests for locked/unlocked, plus the existing suite. Electron click-through
hover behavior is owner-smoke-tested (media/native glue convention).
