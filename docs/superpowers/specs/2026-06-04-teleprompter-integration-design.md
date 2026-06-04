---
type: spec
project: Embalio
status: design-approved
created: 2026-06-04
summary: "Approved design for revamping the Odysseus PowerShell teleprompter prototype into a native, one-click, invisible-to-OBS teleprompter inside Embalio's YouTube Engine — merging the shipped Electron recording cockpit (invisible capture, voice-follow, say/do/fx, markers) with the prototype's live-adjust ergonomics + saved presets, plus a light guided-shoot gate. Electron stack (not Tauri), local electron-store presets, Windows-only."
tags: [spec, embalio, youtube-engine, teleprompter, recording, electron]
---

# Embalio — Teleprompter Integration (Design)

> Supersedes the planning intent in [[Embalio — Teleprompter (Feature Spec)]] with the
> decisions locked in the 2026-06-04 brainstorming session. The Feature Spec remains
> the origin/requirements record; this is the approved, stack-correct design that the
> implementation plan is built from.
>
> Related: [[Embalio — YouTube Engine]] · [[Embalio — Content Workflow (Video Creation Loop)]] ·
> [[Talking-Head Recording Playbook]] · [[Embalio — Recording Profile (Windows home, OBS)]]
>
> Repo mirror: `docs/superpowers/specs/2026-06-04-teleprompter-integration-design.md`

---

## 1. Problem & intent

The Odysseus shoot (2026-06-04) produced a working always-on-top teleprompter as a
PowerShell/WinForms prototype (`content/odysseus-video/Teleprompter Overlay.ps1`). It
proved the ergonomics but is a one-off Windows script. The intent: turn it into a real
Embalio feature so that from a generated video script you **click one button and an
invisible teleprompter is ready to record** — closing the `record` step of the YouTube
Engine loop (capture → research → package → script → **record** → clip).

Two prototypes exist and this design **merges the best of both**:

- The shipped **Electron recording cockpit** (session 6, branch `feat/recording-cockpit`) —
  has the *powers*: invisible-to-OBS, voice-following, `say/do/fx` beats, live markers →
  EDL/chapters. Untested by the owner.
- The **odysseus PS1 overlay** — has the *ergonomics*: live font/size/opacity adjust,
  paragraph↔sentence chunking, named presets + last-layout restore. Tested ("ok-ish").

## 2. Scope (locked in brainstorming)

**In scope:**
- One-click launch of the invisible teleprompter from the Record stage, fed by the
  active project's generated script (no copy-paste).
- The merged teleprompter: cockpit foundation + the PS1's live-adjust controls, chunking,
  and saved presets.
- A **light guided-shoot gate** in the Record stage: a pre-shoot checklist + a 10-second
  audio/framing test.

**Parked / explicit non-goals (this plan):**
- Livestreaming (separate track; low-reach reality per [[Agentic OS — Watchlist & Inspiration]]).
- OBS-websocket orchestration (auto start/stop/scene-switch).
- Batch-shoot queue.
- In-app screen/webcam capture (the playbook says orchestrate OBS, don't capture in-app).
- macOS invisible overlay — **impossible** (macOS Sequoia broke capture-exclusion).
- B-roll fetch/insertion; packaged `.exe` installer; rebindable hotkeys; synced presets.
  (All post-MVP.)

## 3. Decisions (resolved)

| # | Decision | Choice | Why |
|---|---|---|---|
| Stack | Tauri vs current stack | **Electron** (current Next.js web + `/desktop` Electron) | Invisible-to-OBS already works & shipped on Electron; the app is a Next.js *server* app — Tauri would force a full rewrite for zero added capability here. Tauri documented as a future option only if Embalio becomes a packaged product with native capture. |
| One-click | How "click → ready" works | **Option A — Embalio runs as an Electron shell** | Main window loads the web UI; main process supervises the Next server + Whisper sidecar; the Record-stage button opens the invisible overlay via IPC. Only option that truly delivers one-click. No installer in this plan. |
| Q2 (Feature Spec) | Parse vs consume script | **Consume structured beats directly** | `schemas.ts` already exposes `VideoScript { beats: ScriptBeat[] }` with `say/do/fx/...`. Same object Script Studio edits → one source of truth, no HTML parse. |
| Q3 (Feature Spec) | Separate window vs OBS browser-source | **Separate invisible window** | An OBS browser-source would composite the prompter **into** the recording. The cockpit's `setContentProtection(true)` makes it visible to the eye but invisible to OBS — strictly better, and fixes a real gap (the PS1 was only click-through, so it could show in OBS Display Capture). |
| Q1 (Feature Spec) | Hotkeys F7–F10 vs rebindable | **Laptop-safe defaults now; rebindable post-MVP** | Honors prototype gotcha #4 (no numpad). Reconcile cockpit `Ctrl+Arrows` with PS1 `F7–F10` into one documented default set. |
| Presets store | Synced (Supabase) vs local | **Local `electron-store` (MVP), sync later** | The overlay is Windows-only, so cross-machine sync has little value today; presets are per-device layout anyway; avoids an owner-gated migration. Promote to a synced `recording_profiles.teleprompter_presets` jsonb only if a visible Mac prompter ships. |

## 4. Architecture & the one-click flow (Option A)

Embalio's shell becomes the existing `/desktop` Electron process, expanded to two windows:

```
Launch "Embalio" (Electron)
  main process:
   • supervises the Next server (next dev in dev / served build later)
   • supervises the Whisper sidecar (EMBALIO_VOICE=off to skip)
   • opens MAIN WINDOW → loads the web UI (localhost:3000): Topic→Script→Record→Publish
   └ on "🎬 Launch teleprompter" (Record stage):
        IPC overlay:open { projectId }
          → creates the OVERLAY WINDOW (the shipped cockpit):
            frame:false · transparent:true · alwaysOnTop:'screen-saver'
            setContentProtection(true)  (invisible to OBS)
            setIgnoreMouseEvents(true,{forward:true})  (click-through)
            loads /overlay/record/<projectId>
```

- **Browser-dev still works:** open `localhost:3000` in Chrome to build/test the cockpit
  with the Web Speech transcript source. Electron is only needed for invisible-capture +
  real one-click.
- **No installer in this plan** — run the dev Electron app; packaging into a clickable
  `Embalio.exe` is later polish.

## 5. The merged teleprompter

**Keep from the cockpit (foundation):**
- Invisible-to-OBS (`setContentProtection`), click-through.
- Voice-following (Whisper sidecar) with pedal/spacebar/hotkey fallback — manual always wins.
- `say / do / fx` three-lane beats + next-line peek + progress.
- Live markers → DaVinci EDL + YouTube chapters; `confirmTake` → Publish.
- Mirror toggle; fed by `/video-script` beats from Supabase.

**Port in from the PS1 (ergonomics):**
- **Live on-the-fly layout controls** — font ±, width, height, opacity, drag-to-position
  (interactive mode).
- **Paragraph ↔ sentence chunking** — show a whole beat vs one sentence at a time
  (derived client-side from a beat's `say`).
- **Named presets (≥3) save/recall + last-layout auto-restore.**

**One line at a time, not auto-scroll** is the MVP core (manual line-by-line advance).
Voice-following is the realized version of the Feature Spec's post-MVP nice-to-have
("optional auto-advance with manual override") — toggleable, never pixel-scrolling.

### Prototype → Electron port mapping

| Prototype (PowerShell/Win32) | Embalio (Electron) |
|---|---|
| WinForms borderless top-most form | `BrowserWindow { frame:false, transparent:true, alwaysOnTop:'screen-saver' }` |
| `WS_EX_TRANSPARENT` click-through | `win.setIgnoreMouseEvents(true,{forward:true})` |
| `RegisterHotKey` global F-keys | Electron `globalShortcut` |
| *(not in prototype)* invisible to OBS | `win.setContentProtection(true)` → `WDA_EXCLUDEFROMCAPTURE` |
| Parse HTML for lines | Consume `beats[]` from Supabase directly (Q2) |
| `Teleprompter Presets.json` | `electron-store` (`teleprompterStore`) |
| Off-screen hide hack (gotcha #3) | plain `win.hide()` / `win.show()` (no modal-loop bug) |
| Drag via mouse events | CSS `-webkit-app-region: drag` on the bar |
| ASCII-only source (gotcha #2) | N/A — JS/UTF-8 sidesteps it |
| Spaces-in-path launcher (gotcha #1) | N/A — launched via IPC, not a `.cmd` |

## 6. Guided-shoot gate

Lives in the **web Record stage** (plain browser UI), before the one-click launch. Light by design.

- **Pre-shoot checklist** — interactive ticks seeded from
  [[Embalio — Recording Profile (Windows home, OBS)]]'s 90-second checklist (quiet room /
  notifications off, mic ~15–20 cm slightly off-axis, OBS scene ready). Per recording-profile;
  remembers session completion.
- **10-second audio + framing test** (the playbook's core gate):
  - *Audio:* `getUserMedia` mic → Web Audio meter, live peak-dB readout, green band
    **−12 to −6 dB**, warns on clipping/too-quiet. Optional 10s record → headphone playback.
  - *Framing:* webcam preview with rule-of-thirds + headroom guide overlay; "lock
    exposure/focus" reminder (StreamCam tell).
- Ephemeral (a "last passed" timestamp at most). A confidence gate, not a config system.

## 7. Components & data

- `TeleprompterOverlay` — the cockpit window, extended with live-adjust + presets.
- `useTeleprompterController` — hook owning `idx / mode / layout / presets`; exposes
  `next / prev / jump / toggleMode / recallPreset`.
- `teleprompterStore` — thin `electron-store` wrapper (presets + last layout).
- `chunking.ts` — pure, tested sentence/paragraph derivation from a beat's `say`.
- Guided-shoot: a Record-stage checklist component + an audio/framing-test component
  (Web Audio + `getUserMedia`), plus a pure `audio-meter.ts` (peak → dBFS + band class).

**Preset schema (carried from the Feature Spec):**
```json
{
  "presets": {
    "1": { "font": 24, "opacity": 0.7, "width": 800, "height": 130, "top": 40, "left": 560, "mode": "para", "mirror": false }
  },
  "last": { "font": 24, "opacity": 0.7, "width": 800, "height": 130, "top": 40, "left": 560, "mode": "para", "mirror": false }
}
```

**Data contract with the Engine:** the overlay reads `video_projects.script`
(jsonb `VideoScript`) from Supabase via existing server helpers — no new shape. The
prototype's `R`/live-reload becomes a re-fetch. Beats already carry `say/do/fx/...`.

**No DB migration** for MVP (presets are local). If presets are promoted to sync later:
add `recording_profiles.teleprompter_presets jsonb default '[]'` (owner-applied).

## 8. Error handling & honest limits

- STT down / non-Chrome / sidecar crash → auto-fallback to manual pedal/hotkey mode,
  visible status dot. Never blocks recording (the always-working floor).
- Content protection unsupported (Win < 10 2004) → launch-time warning. (Owner is on Win 11.)
- **macOS** cannot do the invisible overlay → Windows-only; a Mac could only ever be a
  *visible* second-screen prompter (not built).
- A physical camera pointed at the screen still sees the overlay (software exclusion only) —
  irrelevant for screen recording.
- Same-screen overlay = eyes on screen, slightly off the lens — fine for screen-share
  videos; mirror + near-webcam positioning mitigate for talking-head.

## 9. Testing strategy

TDD on pure modules:
- `teleprompterStore` — serialize/recall presets + last-layout restore.
- `chunking.ts` — paragraph vs sentence splitting (incl. abbreviations/edge cases).
- `audio-meter.ts` — peak → dBFS, band classification (clip / hot / good / quiet).
- Guided-shoot checklist state.
- `voicefollow` / `markers` — already tested; unchanged.

Component tests: `useTeleprompterController` + live-adjust; overlay renders current vs next.

Manual smoke (Electron main stays thin): one-click launch from the Record stage; invisible
in OBS Display + Window capture; global hotkeys fire while OBS is focused; presets survive
relaunch; voice-follow tracks speech; EDL imports into DaVinci Resolve.

## 10. Build order (each a reviewable slice)

1. **Electron shell** — main window loads the web UI, supervises Next + sidecar,
   `overlay:open` IPC (Option A one-click).
2. **Controller + chunking + live-adjust** (font/width/height/opacity/drag) ported from the PS1.
3. **`teleprompterStore`** — named presets save/recall + last-layout auto-restore.
4. **Guided shoot** — checklist + 10s audio/framing test in the Record stage.
5. **Wire the one-click button** in Record Hub → IPC; reconcile laptop-safe hotkey defaults.

## 11. Keep the prototype alive

The PowerShell overlay stays the Windows daily-driver until this feature ships — do not delete it.
