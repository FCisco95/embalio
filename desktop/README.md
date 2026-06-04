# Embalio Overlay (desktop)

Invisible, always-on-top follow-along recording cockpit. Windows only
(uses WDA_EXCLUDEFROMCAPTURE; macOS Sequoia cannot hide windows from capture).

## Run
1. Start the web app from the repo root: `npm run dev` (with
   `NEXT_PUBLIC_TRANSCRIPT_SOURCE=whisper` in `.env.local` for voice-following).
2. One-time voice deps: `pip install faster-whisper sounddevice numpy` (CUDA build).
3. Install the overlay deps once: `cd desktop && npm install` (pulls the Electron binary).
4. Launch the overlay for a project at the Record stage:
   PowerShell:
   ```powershell
   $env:EMBALIO_PROJECT_ID="<projectId>"
   $env:EMBALIO_EXPORT_DIR="C:\path\to\save"   # optional; defaults to Documents
   cd desktop; npm start
   ```

## Controls (work while unfocused)
- Ctrl+Right / Ctrl+Left — next / previous beat (map a USB foot pedal to these)
- Ctrl+Space — toggle voice-following
- Ctrl+M — drop a marker at the current beat
- Ctrl+I — toggle interactive (to drag/resize), then toggle back to click-through

## Output
On **Stop & export**: `embalio_markers.edl` (DaVinci Resolve) +
`embalio_chapters.txt` (YouTube) written to the export dir; the project advances
to Publish.

## Limits
- A phone CAMERA pointed at the screen still sees the overlay (software exclusion only).
- Voice-following needs the Whisper sidecar (Chrome's Web Speech API does not work inside Electron).
- If voice degrades, the foot pedal / hotkeys are the always-working fallback.
- Set `EMBALIO_VOICE=off` to launch without the Whisper sidecar.
