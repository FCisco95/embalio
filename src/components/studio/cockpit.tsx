"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VideoScript } from "@/lib/studio/schemas";
import { selectView } from "@/lib/studio/cockpit-view";
import { flattenScript, createFollower } from "@/lib/studio/voicefollow";
import { makeTranscriptSource } from "@/lib/studio/transcript";
import { toResolveEDL, toYouTubeChapters, type Marker } from "@/lib/studio/markers";
import { confirmTake } from "@/server/studio/projects";

type ElectronBridge = {
  onHotkey: (cb: (action: string) => void) => (() => void) | void;
  exportMarkers: (files: { edl: string; chapters: string }) => void;
} | undefined;

export function Cockpit({ script, projectId, recordingProfileId, fps = 30 }:
  { script: VideoScript; projectId: string; recordingProfileId: string; fps?: number }) {
  const beats = script.beats;
  const tokens = useMemo(() => flattenScript(beats), [beats]);
  const follower = useMemo(() => createFollower(tokens), [tokens]);

  const [active, setActive] = useState(0);
  const [voiceOn, setVoiceOn] = useState(false);
  const [mirror, setMirror] = useState(false);
  const sessionStart = useRef<number | null>(null);
  const markers = useRef<Marker[]>([]);
  const view = selectView(beats, active);

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
  useEffect(() => {
    const onAction = (action: string) => {
      if (action === "next") go(active + 1);
      else if (action === "prev") go(active - 1);
      else if (action === "playpause") setVoiceOn((v) => !v);
      else if (action === "mark") stamp(active);
    };
    const bridge = (globalThis as { embalio?: ElectronBridge }).embalio;
    const off = bridge?.onHotkey(onAction);
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); go(e.shiftKey ? active - 1 : active + 1); }
      else if (e.code === "ArrowRight") go(active + 1);
      else if (e.code === "ArrowLeft") go(active - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); if (off) off(); };
  }, [active, go, stamp]);

  return (
    <div className="flex min-h-screen flex-col bg-transparent p-3 text-white">
      <div className="mb-2 flex items-center gap-3 text-[11px] text-white/60">
        <span>BEAT {view.progress.n}/{view.progress.total}</span>
        <span className={voiceOn ? "text-emerald-400" : "text-white/40"}>● {voiceOn ? "voice" : "manual"}</span>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setMirror((m) => !m)} className="rounded bg-white/10 px-2 py-0.5">{mirror ? "Unmirror" : "Mirror"}</button>
          <button onClick={startSession} className="rounded bg-white/10 px-2 py-0.5">Start session</button>
          <button onClick={exportNow} className="rounded bg-white/10 px-2 py-0.5">Stop &amp; export</button>
        </div>
      </div>
      <div className="rounded-xl bg-black/70 p-4 backdrop-blur" style={mirror ? { transform: "scaleX(-1)" } : undefined}>
        <div className="text-[28px] font-semibold leading-snug">{view.current.say}</div>
        {view.current.do && <div className="mt-3 border-l-2 border-sky-400 pl-3 text-sky-200">▸ {view.current.do}</div>}
        {view.current.fx && <div className="mt-2 text-[13px] text-amber-300">⚡ {view.current.fx}</div>}
      </div>
      {view.next && <div className="mt-2 truncate px-1 text-[14px] text-white/30">next → {view.next.say}</div>}
    </div>
  );
}
