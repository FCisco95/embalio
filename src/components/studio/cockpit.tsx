"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VideoScript } from "@/lib/studio/schemas";
import { selectView } from "@/lib/studio/cockpit-view";
import { flattenScript, createFollower } from "@/lib/studio/voicefollow";
import { makeTranscriptSource } from "@/lib/studio/transcript";
import { toResolveEDL, toYouTubeChapters, type Marker } from "@/lib/studio/markers";
import { confirmTake } from "@/server/studio/projects";
import { toLines } from "@/lib/studio/chunking";
import { DEFAULT_LAYOUT, adjust, type Layout, type Adjustable } from "@/lib/studio/teleprompter-layout";
import { resolveStore, setPreset, getPreset } from "@/lib/studio/teleprompter-store";

type ElectronBridge = {
  onHotkey: (cb: (action: string) => void) => (() => void) | void;
  exportMarkers: (files: { edl: string; chapters: string }) => void;
  toggleInteractive?: () => void;
  closeOverlay?: () => void;
} | undefined;

export function Cockpit({ script, projectId, recordingProfileId, fps = 30 }:
  { script: VideoScript; projectId: string; recordingProfileId: string; fps?: number }) {
  const beats = script.beats;
  const tokens = useMemo(() => flattenScript(beats), [beats]);
  const follower = useMemo(() => createFollower(tokens), [tokens]);

  const [active, setActive] = useState(0);
  const [voiceOn, setVoiceOn] = useState(false);
  const sessionStart = useRef<number | null>(null);
  const markers = useRef<Marker[]>([]);
  const view = selectView(beats, active);

  // Teleprompter layout, sentence chunking, presets, interactive mode.
  const store = useMemo(() => resolveStore(), []);
  const [layout, setLayout] = useState<Layout>(() => store.load().last ?? DEFAULT_LAYOUT);
  const [lineIdx, setLineIdx] = useState(0);
  const [interactive, setInteractive] = useState(false);
  const currentSay = view.current.say;
  const lines = useMemo(() => toLines(currentSay, layout.mode), [currentSay, layout.mode]);
  // Reset the sentence cursor when the active beat changes. React's documented
  // "adjust state during render" pattern: store the previous beat in state and
  // reset on mismatch — no effect, no ref mutation (React Compiler clean).
  const [seenActive, setSeenActive] = useState(active);
  if (seenActive !== active) { setSeenActive(active); setLineIdx(0); }
  const startLine = Math.min(lineIdx, lines.length - 1);
  // In sentence mode show `layout.lines` consecutive sentences starting at the
  // cursor; the first is full strength, the rest dimmed/smaller (read-ahead).
  const shownLines = layout.mode === "sent"
    ? (lines.length ? lines.slice(startLine, startLine + layout.lines) : [currentSay])
    : [currentSay];

  const stamp = useCallback((index: number) => {
    if (sessionStart.current == null) return;
    const ms = Date.now() - sessionStart.current;
    const b = beats[index];
    markers.current = markers.current.filter((m) => m.beatIndex !== index);
    markers.current.push({ beatIndex: index, ms, label: b.markerLabel ?? b.say.slice(0, 60),
      kind: index === 0 ? "face" : "screen" });
  }, [beats]);

  const go = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(next, beats.length - 1));
    setActive(clamped);
    stamp(clamped);
  }, [beats.length, stamp]);

  const startSession = useCallback(() => { sessionStart.current = Date.now(); markers.current = []; stamp(0); }, [stamp]);

  const exportNow = useCallback(() => {
    if (sessionStart.current == null) return;   // nothing recorded → don't confirm an empty take
    const edl = toResolveEDL([...markers.current].sort((a, b) => a.ms - b.ms), fps);
    const chapters = toYouTubeChapters([...markers.current].sort((a, b) => a.ms - b.ms));
    const bridge = (globalThis as { embalio?: ElectronBridge }).embalio;
    if (bridge) bridge.exportMarkers({ edl, chapters });
    else { console.log(edl); console.log(chapters); }   // browser dev fallback
    confirmTake(projectId, recordingProfileId).catch((e) => console.error(e));
  }, [fps, projectId, recordingProfileId]);

  // Shared layout mutators — used by BOTH the keyboard handler and the action
  // channel (overlay ± buttons + main-window control panel) so there is one
  // source of truth for each adjustment.
  const bump = useCallback((key: Adjustable, d: number) => setLayout((l) => adjust(l, key, d)), []);
  const toggleMode = useCallback(() => setLayout((l) => ({ ...l, mode: l.mode === "para" ? "sent" : "para" })), []);
  const toggleMirror = useCallback(() => setLayout((l) => ({ ...l, mirror: !l.mirror })), []);
  const savePreset = useCallback((slot: string) => setLayout((l) => { setPreset(store, slot, l); return l; }), [store]);
  const recallPreset = useCallback((slot: string) => { const p = getPreset(store, slot); if (p) setLayout(p); }, [store]);
  const closeOverlay = useCallback(() => {
    const bridge = (globalThis as { embalio?: ElectronBridge }).embalio;
    if (bridge?.closeOverlay) bridge.closeOverlay();
    else window.close(); // browser-tab fallback
  }, []);

  // Persist the last layout whenever it changes (recalled on next overlay open).
  useEffect(() => { store.save({ ...store.load(), last: layout }); }, [layout, store]);

  // voice-following
  useEffect(() => {
    if (!voiceOn) return;
    const src = makeTranscriptSource();
    let stopped = false;
    let lastBeat = -1;
    src.start((words) => {
      const s = follower.push(words);
      if (stopped) return;
      if (s.beatIndex !== lastBeat) { lastBeat = s.beatIndex; stamp(s.beatIndex); }
      setActive(s.beatIndex);
    }).catch((e) => { console.error(e); setVoiceOn(false); });
    return () => { stopped = true; src.stop(); };
  }, [voiceOn, follower, stamp]);

  // hardware/global hotkeys (Electron) + keyboard fallback
  const mode = layout.mode;
  useEffect(() => {
    // In sentence mode, next/prev walk lines first, then spill into beats.
    const goNext = () => {
      if (mode === "sent" && lineIdx < lines.length - 1) setLineIdx((i) => i + 1);
      else go(active + 1);
    };
    const goPrev = () => {
      if (mode === "sent" && lineIdx > 0) setLineIdx((i) => i - 1);
      else go(active - 1);
    };
    const onAction = (action: string) => {
      // Navigation + session actions arrive regardless of interactive state.
      if (action === "next") return goNext();
      if (action === "prev") return goPrev();
      if (action === "playpause") return setVoiceOn((v) => !v);
      if (action === "mark") return stamp(active);
      if (action === "interactive-on") return setInteractive(true);
      if (action === "interactive-off") return setInteractive(false);
      // Deliberate control actions (panel clicks / overlay buttons) — they act
      // regardless of `interactive` because the click itself is the intent.
      if (action === "font+") return bump("font", 2);
      if (action === "font-") return bump("font", -2);
      if (action === "opacity+") return bump("opacity", 0.05);
      if (action === "opacity-") return bump("opacity", -0.05);
      if (action === "width+") return bump("width", 60);
      if (action === "width-") return bump("width", -60);
      if (action === "height+") return bump("height", 16);
      if (action === "height-") return bump("height", -16);
      if (action === "lines+") return bump("lines", 1);
      if (action === "lines-") return bump("lines", -1);
      if (action === "mode") return toggleMode();
      if (action === "mirror") return toggleMirror();
      const saveM = /^preset-save-([1-3])$/.exec(action);
      if (saveM) return savePreset(saveM[1]);
      const recallM = /^preset-([1-3])$/.exec(action);
      if (recallM) return recallPreset(recallM[1]);
    };
    const bridge = (globalThis as { embalio?: ElectronBridge }).embalio;
    const off = bridge?.onHotkey(onAction);
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); if (e.shiftKey) goPrev(); else goNext(); return; }
      if (e.code === "ArrowRight") { goNext(); return; }
      if (e.code === "ArrowLeft") { goPrev(); return; }

      if (!interactive) return; // live-adjust + presets only when interactive (between takes)
      const kbBump = (key: Adjustable, d: number) => { e.preventDefault(); bump(key, d); };
      if (e.code === "Equal") kbBump("font", 2);
      else if (e.code === "Minus") kbBump("font", -2);
      else if (e.code === "BracketLeft") kbBump("width", -60);
      else if (e.code === "BracketRight") kbBump("width", 60);
      else if (e.code === "Semicolon") kbBump("height", -16);
      else if (e.code === "Quote") kbBump("height", 16);
      else if (e.code === "Comma") kbBump("opacity", -0.05);
      else if (e.code === "Period") kbBump("opacity", 0.05);
      else if (e.code === "ArrowUp") kbBump("lines", 1);
      else if (e.code === "ArrowDown") kbBump("lines", -1);
      else if (e.code === "KeyS") toggleMode();
      else if (e.code === "KeyR") toggleMirror();
      else if (/^Digit[1-3]$/.test(e.code)) {
        const slot = e.code.slice(5);
        if (e.shiftKey) savePreset(slot);
        else recallPreset(slot);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); if (off) off(); };
  }, [active, go, stamp, interactive, mode, lineIdx, lines.length,
      bump, toggleMode, toggleMirror, savePreset, recallPreset]);

  return (
    <div className="flex min-h-screen flex-col bg-transparent p-3 text-white" style={{ opacity: layout.opacity }}>
      <div
        className="mb-2 flex items-center gap-3 text-[11px] text-white/60"
        // In interactive mode the status row is the Electron window's drag handle
        // (spec §5: -webkit-app-region: drag). Inert in browser tabs and in
        // click-through mode (where it's omitted anyway). WebkitAppRegion is a
        // non-standard CSSProperties field, hence the cast.
        style={interactive ? ({ WebkitAppRegion: "drag" } as React.CSSProperties) : undefined}
      >
        <span>BEAT {view.progress.n}/{view.progress.total}</span>
        {layout.mode === "sent" && <span>L {Math.min(lineIdx, lines.length - 1) + 1}/{lines.length}</span>}
        <span className={voiceOn ? "text-emerald-400" : "text-white/40"}>● {voiceOn ? "voice" : "manual"}</span>
        <span className={interactive ? "text-amber-300" : "text-white/40"}>{interactive ? "◆ adjust" : "◇ live"}</span>
        <span className="text-white/40">{layout.mode}</span>
        <div
          className="ml-auto flex gap-2"
          // Buttons opt out of the drag region so they stay clickable.
          style={interactive ? ({ WebkitAppRegion: "no-drag" } as React.CSSProperties) : undefined}
        >
          <button onClick={() => {
            const bridge = (globalThis as { embalio?: ElectronBridge }).embalio;
            if (bridge?.toggleInteractive) bridge.toggleInteractive(); // native flags + UI sync via hotkey channel
            else setInteractive((v) => !v);                            // browser-dev fallback (no native flags)
          }} className="rounded bg-white/10 px-2 py-0.5">{interactive ? "Live" : "Adjust"}</button>
          <button onClick={toggleMirror} className="rounded bg-white/10 px-2 py-0.5">{layout.mirror ? "Unmirror" : "Mirror"}</button>
          {interactive && (
            <>
              <button onClick={() => bump("font", 2)} className="rounded bg-white/10 px-2 py-0.5" title="font +">A+</button>
              <button onClick={() => bump("font", -2)} className="rounded bg-white/10 px-2 py-0.5" title="font -">A-</button>
              <button onClick={() => bump("lines", 1)} className="rounded bg-white/10 px-2 py-0.5" title="lines +">☰+</button>
              <button onClick={() => bump("lines", -1)} className="rounded bg-white/10 px-2 py-0.5" title="lines -">☰-</button>
              <button onClick={() => bump("opacity", 0.05)} className="rounded bg-white/10 px-2 py-0.5" title="opacity +">◐+</button>
              <button onClick={() => bump("opacity", -0.05)} className="rounded bg-white/10 px-2 py-0.5" title="opacity -">◐-</button>
            </>
          )}
          <button onClick={startSession} className="rounded bg-white/10 px-2 py-0.5">Start session</button>
          <button onClick={exportNow} className="rounded bg-white/10 px-2 py-0.5">Stop &amp; export</button>
          {interactive && <button onClick={closeOverlay} className="rounded bg-white/10 px-2 py-0.5" title="close overlay">✕</button>}
        </div>
      </div>
      <div className="rounded-xl bg-black/70 p-4 backdrop-blur"
           style={{ transform: layout.mirror ? "scaleX(-1)" : undefined, fontSize: layout.font, width: layout.width, maxHeight: layout.height, overflowY: "auto" }}>
        {shownLines.map((line, i) => (
          <div
            key={i}
            className={i === 0 ? "font-semibold leading-snug" : "font-semibold leading-snug text-white/40"}
            style={i === 0 ? undefined : { fontSize: "0.8em" }}
          >
            {line}
          </div>
        ))}
        {view.current.do && <div className="mt-3 border-l-2 border-sky-400 pl-3 text-sky-200 text-base">▸ {view.current.do}</div>}
        {view.current.fx && <div className="mt-2 text-[13px] text-amber-300">⚡ {view.current.fx}</div>}
      </div>
      {view.next && <div className="mt-2 truncate px-1 text-[14px] text-white/30">next → {view.next.say}</div>}
    </div>
  );
}
