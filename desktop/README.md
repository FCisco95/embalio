# Embalio Desktop (Electron shell + invisible overlay)

Electron is Embalio's app shell: a normal main window loads the web UI, and the
invisible, always-on-top teleprompter overlay opens on demand from the Record
Hub. Windows only (uses WDA_EXCLUDEFROMCAPTURE; macOS Sequoia cannot hide
windows from capture).

## Run (one-click)

1. One-time: `cd desktop && npm install` (pulls the Electron binary + electron-store).
2. One-time voice deps: `pip install faster-whisper sounddevice numpy` (CUDA build),
   with `NEXT_PUBLIC_TRANSCRIPT_SOURCE=whisper` in the repo-root `.env.local`.
3. Launch:
   ```powershell
   cd desktop; npm start
   ```
   If the Next dev server isn't already running on :3000, the shell spawns
   `npm run dev` at the repo root and waits for it. The Embalio window opens at
   the dashboard.
4. Navigate to a Record-stage project, work the pre-shoot checklist, then click
   **🎬 Launch teleprompter** — the invisible overlay opens for that project.

Env vars (all optional):
- `EMBALIO_URL` — web app URL (default `http://localhost:3000`)
- `EMBALIO_NO_SPAWN=1` — never spawn the dev server (you manage it yourself)
- `EMBALIO_EXPORT_DIR` — marker export dir (default Documents)
- `EMBALIO_VOICE=off` — launch without the Whisper sidecar

## Controls

The overlay is click-through by default (invisible to capture, never steals
focus), so you drive it **with the mouse from the main Embalio window**. Once the
overlay is open, a control panel appears under **🎬 Launch teleprompter** in the
Record Hub — this is the primary control surface:

- **Unlock/Lock** — toggle interactive mode (click-through off so you can drag/resize/click the overlay)
- **Close** — close the overlay
- Text size − / + · Lines − / + · Opacity − / + · Width − / + · Height − / +
- **Sentence/Paragraph** · **Mirror**
- **Save 1/2/3** and **Recall 1/2/3** — layout presets (persisted via electron-store)

When the overlay is unlocked (interactive), it also shows on-overlay buttons in
its status row: a **✕** close button plus compact **A+ A-** (font), **☰+ ☰-**
(lines) and **◐+ ◐-** (opacity) controls. Drag the overlay by its status row.

### Hotkeys (secondary, work while unfocused)

- Ctrl+Right / Ctrl+Left — next / previous beat (sentence mode: next/previous line first)
- Ctrl+Space — toggle voice-following
- Ctrl+M — drop a marker at the current beat
- Ctrl+I — toggle interactive mode (click-through off; drag via the status row, resize, adjust)

Interactive mode only (between takes):
- `=` / `-` — font size · `[` / `]` — width · `;` / `'` — height · `,` / `.` — opacity
- `↑` / `↓` — lines visible at once (sentence mode)
- `S` — paragraph/sentence mode · `R` — mirror
- `1`–`3` — recall preset · `Shift+1`–`3` — save preset (persisted via electron-store)

## Output

On **Stop & export**: `embalio_markers.edl` (DaVinci Resolve) +
`embalio_chapters.txt` (YouTube) written to the export dir; the project advances
to Publish.

## Limits

- A phone CAMERA pointed at the screen still sees the overlay (software exclusion only).
- Voice-following needs the Whisper sidecar (Chrome's Web Speech API does not work inside Electron).
- If voice degrades, the foot pedal / hotkeys are the always-working fallback.
- Preset `top`/`left` window position is not yet restored on recall (drag the
  overlay in interactive mode instead).
