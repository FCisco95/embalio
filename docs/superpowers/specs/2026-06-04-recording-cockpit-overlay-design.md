# Recording Cockpit — Invisible Same-Screen Follow-Along Overlay

**Date:** 2026-06-04
**Status:** Design approved, pending spec review → plan
**Branch target:** off `make-it-true`
**Spec author:** brainstorm with owner (Cisco), grounded in a 5-agent research pass

---

## Problem

Recording a video currently eats a whole day. The owner's two concrete pain
points (confirmed, not guessed):

1. **Remembering / reading the lines** — fixed-speed teleprompter scroll never
   matches natural pace, so takes break and restart.
2. **Knowing what to DO at each step** — the choreography of "say this line
   while clicking that thing, and this is the edit it needs" lives only in static
   HTML shooting guides, not in front of the creator while recording.

The existing in-app Record Hub (`src/components/studio/record-hub.tsx`) is a thin
static list of `say` + `visualPrompt`. The richer model already exists on paper:
the `content/odysseus-video` HTML guides use a **`say` / `do` / `fx`** three-lane
beat model, and a standalone teleprompter HTML does continuous auto-scroll with
mirror + eyeline guide. This project turns that paper model into a **live,
follow-along recording cockpit** that does not appear in the screen recording.

## Hard requirement (owner, non-negotiable)

The prompter must sit **on the same screen the owner is recording**, visible to
their eyes but **invisible to the screen recorder**, so on camera it looks like
they are simply looking at their own work — never glancing off to a side device.

This requirement is the spine of the whole design. It rules out a browser-only
or second-device solution as the primary, and it is **achievable only via a
native desktop shell** (see Architecture).

## Goals

- A floating, always-on-top **cockpit** over whatever the owner is doing, showing
  the current beat's **SAY / DO / FX**, a one-line peek at the next line, and
  progress — **invisible to OBS and other screen recorders**.
- The prompter **follows the owner's voice** (scrolls to match speech, holds on
  pause/ad-lib), with a **foot-pedal / spacebar** manual fallback that always works.
- Each beat advance silently **stamps a timecode marker**; on stop the cockpit
  **exports a DaVinci Resolve EDL + YouTube chapters** so the edit map is built
  by the time recording ends.
- Slots into the existing `/studio` pipeline (`topic → script → record → publish`)
  via the existing `confirmTake` handoff.

## Non-goals (v1)

- macOS invisible overlay — **impossible** on macOS 15+ (Sequoia broke
  `NSWindowSharingNone` against ScreenCaptureKit). This overlay is **Windows-only**.
- Cross-device sync (Supabase Realtime). Because the overlay runs on the same PC
  being recorded, no PC→device sync is needed. Deferred to a later "phone control"
  idea.
- OBS auto-start (OBS-websocket). v1 keeps starting OBS manual; owner presses
  "Start session" in the cockpit at the moment they hit record.
- Auto B-roll fetch/insertion. We generate `brollKeywords` per beat; actually
  pulling stock footage is v2.
- In-app screen capture. The cockpit orchestrates an *external* recorder (OBS),
  it does not capture video itself.

---

## Architecture

Three pieces, **one React UI**:

```
Windows recording PC
├─ OBS records the screen           ← never sees the overlay
├─ Electron overlay shell  (NEW /desktop)
│    • transparent, frameless, always-on-top, non-focusable
│    • setContentProtection(true)   → WDA_EXCLUDEFROMCAPTURE (invisible to capture)
│    • setIgnoreMouseEvents(true,{forward:true})  → click-through
│    • globalShortcut: next / prev / mark / play-pause / toggle-interactive / nudge
│    • spawns + supervises the Whisper sidecar
│    • writes the EDL/chapters file on stop
│    └─ loads localhost:3000/overlay/record/<projectId>
│         └─ Cockpit (Next.js route — the ONE React UI)
│              • reads project + beats from Supabase (existing helpers)
│              • renders SAY / DO / FX / next-peek / progress
│              • scroll driven by the voice-follow engine
└─ Whisper sidecar  (NEW /desktop/sidecar)
     • default mic → local streaming STT on the RTX 3080
     • recognized words → ws://127.0.0.1:<port> → cockpit
```

**Why a desktop app at all:** a browser tab physically cannot set the OS
capture-exclusion flag. Electron's `BrowserWindow.setContentProtection(true)` maps
exactly to Windows `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)`
(Win10 2004+ / Win11). Verified to exclude the window from OBS Display Capture
(DXGI + WGC), OBS Window Capture, Zoom/Teams/Loom share, Chrome `getDisplayMedia`,
Snipping Tool, and Print Screen. (A physical camera pointed at the monitor still
sees it — irrelevant for screen recording.)

**Why same-machine simplifies things:** the prompter and the recorder are the
same PC, so there is no cross-device state to sync. The cockpit reads the script
straight from Supabase like the rest of the app.

**UI built web-first:** the cockpit is an ordinary Next.js page. In Chrome it runs
today with the Web Speech API as the word source (for building/testing). Inside
Electron it gains the three native powers (float-on-top, invisible-to-capture,
click-through) and switches the word source to the Whisper sidecar. No UI rework
between the two.

---

## Components

### 1. Beat model extension — `src/lib/studio/schemas.ts`

Extend `ScriptBeat` with **all-optional** fields (old scripts still parse; the
script is stored as jsonb, so **no DB migration**):

```ts
export const ScriptBeat = z.object({
  id: z.string().min(1),
  say: z.string().min(1).max(600),
  visualPrompt: z.string().min(1).max(400),
  estSeconds: z.number().min(1).max(120).optional(),
  // NEW — follow-along + shoot→edit
  do: z.string().max(200).optional(),            // imperative live action, e.g. "Click [Cookbook] → Run scan"
  fx: z.string().max(200).optional(),            // edit cue shown live, e.g. "punch-zoom + freeze on \"No GPU\""
  ost: z.string().max(120).optional(),           // on-screen caption text for the edit
  brollKeywords: z.array(z.string().max(40)).max(3).optional(),
  markerLabel: z.string().max(80).optional(),    // label stamped to the marker file
});
```

`VideoScript` is unchanged in shape. `record-hub.tsx`'s current `{say, visualPrompt}`
render keeps working; the cockpit uses the new fields when present.

### 2. Script generation — `src/lib/studio/brain.ts`

Extend `buildScriptPrompt` so the beat instruction block asks for `do`, `fx`,
`ost`, `brollKeywords`, `markerLabel`, with a one-shot example beat. Generated
through the existing `generateStructured` + zod path so the schema is enforced.
All new fields optional → graceful degradation if the model omits one. The
Channel Playbook already feeds the script call; this just enriches the per-beat
output to match the `say/do/fx` guide format.

### 3. Cockpit UI — `src/app/overlay/record/[projectId]/page.tsx`

A **takeover route** outside the `(app)` group (no nav chrome, like `/setup`),
`force-dynamic`. Transparent-friendly, dark, small fixed card:

- **Progress rail** — beat N / total, done/active/remaining.
- **SAY** — dominant, the teleprompter line(s), high contrast, large.
- **DO** — below a rule, imperative + bracketed target.
- **FX** — smallest, accent color, icon-prefixed (note-to-self, shown live).
- **next →** — one dimmed line peeking the next SAY (never the next DO/FX).
- **status dot** — voice-following vs manual; mic health.
- **mirror toggle** — carried from the existing teleprompter HTML, for face-cam.

Reads project + script via existing server helpers (`server/studio/project-helpers.ts`,
`projects.ts`). Presentation is server-rendered; a client controller owns scroll
position, active beat, and advance events. Fully click-through during recording;
a hotkey toggles "interactive" mode between takes to drag/resize/configure.

### 4. Transcript source seam — `src/lib/studio/transcript/`

Mirrors the existing `BrainClient` singleton seam. Interface emits a stream of
recognized word tokens:

```ts
export interface TranscriptSource {
  start(onWords: (words: string[]) => void): Promise<void>;
  stop(): void;
}
```

- `webSpeechSource` — `webkitSpeechRecognition`, `interimResults: true`,
  auto-restart on the ~60s Chrome timeout. For browser dev/test. Free.
- `whisperSidecarSource` — connects to `ws://127.0.0.1:<port>` from the Whisper
  sidecar. Production / Electron. Local, free, private, GPU-accelerated.

The exported singleton is the only line to change between environments — UI and
engine untouched.

### 5. Voice-follow engine — `src/lib/studio/voicefollow.ts`

**Pure, fully unit-tested**, no DOM and no mic. Input: the flattened beats→words
script and an incoming stream of recognized words. Output: current word index,
scroll target (look-ahead a few words), and current beat index. Rules:

- **Advance-only** — position never moves backward on interim-result volatility.
- **Fuzzy match** — Dice coefficient (or Levenshtein), threshold ~0.7, with a
  small look-ahead window so light ad-libs/mis-hears don't stall.
- **Hold on pause** — no matches for a short window → freeze.
- **Skip-jump** — if the speaker clearly jumps ahead in the script, snap forward.

### 6. Advance controller — client hook in the cockpit

Merges voice-follow position with manual events (pedal / spacebar / hotkeys).
Manual always wins and can hold/override voice. Computes the active beat; on each
**beat activation** emits a "beat advanced" event → marker stamp. Going back
(Shift+Space / Left) overwrites that beat's marker (clean final advance point).

### 7. Markers + export — `src/lib/studio/markers.ts`

**Pure, unit-tested.** Session holds `{ beatId, ms }` where `ms = now − sessionStart`
(owner presses "Start session" when they hit record). On stop:

- `toResolveEDL(markers, fps)` → DaVinci-importable `.edl`; point markers with
  `|C:ResolveColor…` (face / screen / CTA / retake convention), `|M:<markerLabel>`,
  `|D:1`; timecode `HH:MM:SS:FF` at the configured fps (24/30).
- `toYouTubeChapters(markers, beats)` → `0:00 …` text (first entry forced to 0:00,
  ≥10s spacing, ≥3 entries).

Files written to the active `recording_profiles.export_path`. Then the existing
`confirmTake(projectId, recordingProfileId)` advances the stage rail to Publish.

### 8. Electron overlay shell — `/desktop`

Thin main process; **all real logic lives in the tested modules above**. Creates a
transparent, frameless, `alwaysOnTop('screen-saver')`, `skipTaskbar`, non-focusable
`BrowserWindow`; `setContentProtection(true)`; `setIgnoreMouseEvents(true,{forward:true})`;
loads `http://localhost:3000/overlay/record/<projectId>`. Registers `globalShortcut`
for next / prev / mark / play-pause / toggle-interactive / nudge-position (so a
USB foot pedal sending keystrokes works even though the window never takes focus).
Spawns + supervises the Whisper sidecar; relays sidecar words and hotkey events to
the renderer over IPC; writes the export file on stop. Project selection for v1:
a minimal picker or a passed `projectId` (deep-link / arg).

### 9. Whisper sidecar — `/desktop/sidecar`

Small process: captures the default mic, runs **local streaming Whisper on the
RTX 3080** (whisper.cpp streaming or faster-whisper), emits recognized words over
a local WebSocket the renderer subscribes to. Config: model size (small/medium),
`language: en`. **This is the heaviest dependency and the main risk** — it is
strictly isolated behind the `TranscriptSource` seam, and the manual pedal mode is
the always-available floor, so a bad STT day never blocks a recording.

---

## Data flow

1. Author generates a script in `/studio` (existing) → beats now include
   `do/fx/ost/brollKeywords/markerLabel`.
2. Owner launches the Electron overlay for a project; the cockpit loads its beats.
3. Owner starts OBS recording and presses **Start session** in the cockpit.
4. As they speak: mic → Whisper sidecar → words → voice-follow engine → scroll +
   active beat. Pedal/spacebar overrides and holds.
5. Each beat activation stamps a marker (`ms` since session start).
6. Owner stops: cockpit exports `.edl` + `chapters.txt` to `export_path`, calls
   `confirmTake`, and the stage rail moves to Publish.

## Error handling & honest limits

- STT down / non-Chrome / sidecar crash → **auto-fallback to manual pedal mode**,
  visible status dot. Never blocks recording.
- Content protection unsupported (Win < 10 2004) → launch-time warning. (Owner is
  on Win 11 → fine.)
- **macOS cannot do the invisible overlay** (Sequoia). Documented as Windows-only;
  a Mac could only be a *visible* second-screen prompter (not built here).
- Face-cam to-lens delivery: same-screen overlay = eyes on screen, slightly off
  the lens. Fine for screen-share videos; an accepted trade for pure talking-head.
  Mirror + positioning near the webcam mitigates.
- Supabase fetch failure → cockpit shows an error + retry; recording is never
  silently broken.
- Missing `export_path` → prompt for a folder, default to Documents.

## Testing strategy

TDD on every pure module:
- **voicefollow** — advance-only, threshold, ad-lib hold, skip-jump.
- **markers** — EDL timecode@fps + label sanitization; chapters 0:00/spacing/min-3.
- **schema** — old beats lacking `do/fx/…` still parse (back-compat).
- **brain prompt** — structured-output shape includes the new fields.
- **cockpit component** — renders current vs next, lane hierarchy.

Electron main stays thin → a short **manual smoke checklist**: invisible in OBS,
click-through, global hotkeys fire while unfocused, sidecar words flow, EDL imports
into Resolve.

## Build order (each a reviewable slice)

1. Beat model + `buildScriptPrompt` extension (+ back-compat tests).
2. Pure engines TDD: `voicefollow.ts`, `markers.ts`.
3. Cockpit UI as a Next.js route, testable in Chrome via `webSpeechSource`.
4. Electron shell: invisibility + always-on-top + click-through + global hotkeys.
5. Whisper sidecar + `whisperSidecarSource`.
6. Export wiring + `confirmTake` handoff into the Publish stage.

## Key references (from the research pass)

- Windows `SetWindowDisplayAffinity` / `WDA_EXCLUDEFROMCAPTURE` — Microsoft Learn;
  Electron PR #24274 (`setContentProtection`); OBS PR #5698 (self-hiding).
- Voice-following teleprompters — PromptSmart VoiceTrack, Speakflow Flow Mode;
  Web Speech API + Dice-coefficient word match (Elijah Manor / egghead patterns).
- Live markers → editor — Camtasia Ctrl+M, OBS StreamUP chapter manager; DaVinci
  Resolve EDL marker import; YouTube chapters format.
- Hands-free control — generic USB HID foot pedal / AirTurn PED 500 / Elgato pedal.
