"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { VideoScript } from "@/lib/studio/schemas";
import { selectView } from "@/lib/studio/cockpit-view";
import { flattenScript, createFollower } from "@/lib/studio/voicefollow";
import { makeTranscriptSource } from "@/lib/studio/transcript";
import { toResolveEDL, toYouTubeChapters, type Marker } from "@/lib/studio/markers";
import { confirmTake } from "@/server/studio/projects";
import { toLines } from "@/lib/studio/chunking";
import { DEFAULT_LAYOUT, adjust, clampLayout, type Layout, type Adjustable } from "@/lib/studio/teleprompter-layout";
import { resolveStore, setPreset, getPreset } from "@/lib/studio/teleprompter-store";

type ElectronBridge = {
  onHotkey: (cb: (action: string) => void) => (() => void) | void;
  exportMarkers: (files: { edl: string; chapters: string }) => void;
  toggleInteractive?: () => void;
  closeOverlay?: () => void;
  setIgnoreMouse?: (ignore: boolean) => void;
} | undefined;

const embalioBridge = () => (globalThis as { embalio?: ElectronBridge }).embalio;

// Layered shadow keeps white text readable over any desktop (no background card).
const TEXT_SHADOW = "0 1px 2px rgba(0,0,0,.95), 0 0 10px rgba(0,0,0,.85), 0 0 24px rgba(0,0,0,.6)";
const STRIP_BTN = "rounded bg-white/10 px-2 py-0.5 hover:bg-white/25";

// Hydration gate for useSyncExternalStore: false on the server (and during the
// hydration render), true on the client afterwards.
const noopSubscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

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
  // Start from defaults on BOTH server and client first render — reading client
  // storage during hydration causes an SSR mismatch. Once hydrated, apply the
  // persisted layout exactly once via React's render-phase "adjust state"
  // pattern (the repo's React Compiler lint rejects setState-in-effect).
  // storeLoaded also gates persistence so defaults never overwrite the store.
  const hydrated = useSyncExternalStore(noopSubscribe, clientSnapshot, serverSnapshot);
  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT);
  const [storeLoaded, setStoreLoaded] = useState(false);
  if (hydrated && !storeLoaded) {
    setStoreLoaded(true);
    setLayout(clampLayout({ ...DEFAULT_LAYOUT, ...(store.load().last ?? {}) }));
  }
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
    const bridge = embalioBridge();
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
  const recallPreset = useCallback((slot: string) => { const p = getPreset(store, slot); if (p) setLayout(clampLayout({ ...DEFAULT_LAYOUT, ...p })); }, [store]);
  const closeOverlay = useCallback(() => {
    const bridge = embalioBridge();
    if (bridge?.closeOverlay) bridge.closeOverlay();
    else window.close(); // browser-tab fallback
  }, []);

  // Lock/unlock: in Electron round-trip through main (native flags + state come
  // back via the hotkey channel); in a browser tab just flip the local flag.
  const lockToggle = useCallback(() => {
    const bridge = embalioBridge();
    if (bridge?.toggleInteractive) bridge.toggleInteractive();
    else setInteractive((v) => !v);
  }, []);

  // Persist the last layout whenever it changes (recalled on next overlay open).
  useEffect(() => {
    if (!storeLoaded) return; // don't clobber the stored layout with defaults pre-load
    store.save({ ...store.load(), last: layout });
  }, [layout, store, storeLoaded]);

  // The Electron overlay window is transparent — clear the app theme's page
  // background so the desktop shows through, and hide the Next.js dev-tools
  // badge (chrome has no place on a subtitle overlay). Browser tabs keep both.
  useEffect(() => {
    if (!embalioBridge()) return;
    const html = document.documentElement;
    const body = document.body;
    const prev = { html: html.style.background, body: body.style.background };
    html.style.background = "transparent";
    body.style.background = "transparent";
    const style = document.createElement("style");
    style.textContent = "nextjs-portal{display:none !important}";
    document.head.appendChild(style);
    return () => {
      html.style.background = prev.html;
      body.style.background = prev.body;
      style.remove();
    };
  }, []);

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
      if (action === "session-start") return startSession();
      if (action === "session-export") return exportNow();
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
    const off = embalioBridge()?.onHotkey(onAction);
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
      bump, toggleMode, toggleMirror, savePreset, recallPreset, startSession, exportNow]);

  return (
    <div className="flex min-h-screen flex-col p-3 text-white">
      {/* Unlocked: one minimal control strip. Locked: nothing but the text. */}
      {interactive && (
        <div
          className="mb-2 flex w-fit items-center gap-1.5 rounded-lg bg-black/50 px-1.5 py-1 text-[12px] backdrop-blur"
          // Buttons opt out of the drag region (the text block below is the handle).
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <button onClick={lockToggle} className={STRIP_BTN} title="lock (click-through)">🔓</button>
          <button onClick={() => bump("font", -2)} className={STRIP_BTN} title="text smaller">A−</button>
          <button onClick={() => bump("font", 2)} className={STRIP_BTN} title="text bigger">A+</button>
          <button onClick={() => bump("lines", -1)} className={STRIP_BTN} title="fewer sentences">☰−</button>
          <button onClick={() => bump("lines", 1)} className={STRIP_BTN} title="more sentences">☰+</button>
          <span className="px-1 text-white/40">{view.progress.n}/{view.progress.total}</span>
          <button onClick={closeOverlay} className={STRIP_BTN} title="close overlay">✕</button>
        </div>
      )}

      {/* The subtitle: a snug pill hugging the text (iPhone Live Captions
          style). Text is ALWAYS full strength — `opacity` darkens the pill
          backdrop (0.2 barely-there … 1 solid black). Drag handle when unlocked. */}
      <div
        className="w-fit rounded-2xl px-4 py-3"
        style={{
          backgroundColor: `rgba(0, 0, 0, ${layout.opacity})`,
          transform: layout.mirror ? "scaleX(-1)" : undefined,
          fontSize: layout.font,
          maxWidth: layout.width,
          maxHeight: layout.height,
          overflowY: "auto",
          textShadow: TEXT_SHADOW,
          ...(interactive ? { WebkitAppRegion: "drag", cursor: "move" } : {}),
        } as React.CSSProperties}
      >
        {shownLines.map((line, i) => (
          <div
            key={i}
            className={i === 0 ? "font-semibold leading-snug" : "font-semibold leading-snug text-white/85"}
            style={i === 0 ? undefined : { fontSize: "0.8em" }}
          >
            {line}
          </div>
        ))}
        {view.current.do && <div className="mt-3 border-l-2 border-sky-400 pl-3 text-sky-200 text-base">▸ {view.current.do}</div>}
        {view.current.fx && <div className="mt-2 text-[13px] text-amber-300">⚡ {view.current.fx}</div>}
      </div>

      {/* Locked: a faint lock icon is the only affordance. The window is
          click-through, but forward:true keeps mousemove flowing — hovering the
          icon momentarily re-enables clicks so it can be pressed. */}
      {!interactive && (
        <button
          type="button"
          title="unlock teleprompter"
          onMouseEnter={() => embalioBridge()?.setIgnoreMouse?.(false)}
          onMouseLeave={() => embalioBridge()?.setIgnoreMouse?.(true)}
          onClick={lockToggle}
          className="mt-1.5 w-fit rounded-md bg-black/60 px-2 py-0.5 text-[13px] text-white/80 transition-colors hover:bg-black/85 hover:text-white"
        >
          🔒
        </button>
      )}
    </div>
  );
}
