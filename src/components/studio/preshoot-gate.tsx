"use client";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { checklistFor, toggle, allChecked } from "@/lib/studio/preshoot-checklist";
import { peakToDbfs, classifyDbfs, type Band } from "@/lib/studio/audio-meter";

const BAND_COLOR: Record<Band, string> = {
  clip: "text-red-500", hot: "text-amber-400", good: "text-emerald-400", quiet: "text-white/50",
};

const TEST_MS = 10_000;

export function PreshootGate({ captureTool }: { captureTool: string }) {
  const items = checklistFor(captureTool);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [db, setDb] = useState(-100);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cleanup = useRef<() => void>(() => {});

  async function runTest() {
    setError(null);
    setTesting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
      src.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      let raf = 0;
      let timer = 0;
      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        let peak = 0; for (const v of buf) peak = Math.max(peak, Math.abs(v));
        setDb(peakToDbfs(peak));
        raf = requestAnimationFrame(tick);
      };
      tick();
      cleanup.current = () => {
        cancelAnimationFrame(raf); clearTimeout(timer); stream.getTracks().forEach((t) => t.stop()); ctx.close();
      };
      // Labeled as a "10s test": auto-stop so the stream/mic release on their own.
      timer = window.setTimeout(() => { cleanup.current(); cleanup.current = () => {}; setTesting(false); }, TEST_MS);
    } catch {
      cleanup.current(); cleanup.current = () => {};
      setError("Couldn't access camera/mic — close other apps using them and check permissions.");
      setTesting(false);
    }
  }

  useEffect(() => () => cleanup.current(), []);
  const band = classifyDbfs(db);

  return (
    <Card><CardContent className="space-y-4 pt-5">
      <div className="text-[13px] font-medium text-muted-foreground">Pre-shoot checklist</div>
      <ul className="space-y-1.5">
        {items.map((i) => (
          <li key={i.id}>
            <label className="flex items-start gap-2 text-[13px]">
              <input type="checkbox" checked={!!checked[i.id]} onChange={() => setChecked((s) => toggle(s, i.id))} />
              <span>{i.label}</span>
            </label>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3">
        <Button onClick={runTest} disabled={testing}>Run 10s audio + framing test</Button>
        <span className={`font-mono text-[13px] ${BAND_COLOR[band]}`}>
          {db <= -100 ? "—" : `${db.toFixed(1)} dBFS · ${band}`}
        </span>
      </div>
      {error && <div className="text-[12px] text-red-500">{error}</div>}
      <video ref={videoRef} muted className="aspect-video w-full max-w-md rounded-lg bg-black"
             style={{ display: testing ? "block" : "none" }} />
      <div className="text-[11px] text-muted-foreground">
        Target: speech peaks -12 to -6 dB (green). Lock exposure + focus on the StreamCam; eyes ~upper third.
      </div>
      {allChecked(items, checked) && <div className="text-[12px] text-emerald-500">Checklist complete ✓</div>}
    </CardContent></Card>
  );
}
