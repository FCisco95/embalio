import type { TranscriptSource } from "./types";
import { normalizeWords } from "./types";

/**
 * Browser Web Speech API source (Chrome/Edge). For building/testing the cockpit
 * UI in a normal browser. Does NOT work inside Electron (no Google backend) —
 * use the whisper sidecar there.
 */
export function webSpeechSource(): TranscriptSource {
  type SR = { continuous: boolean; interimResults: boolean; lang: string; start(): void; stop(): void;
    onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
    onend: (() => void) | null; };
  let rec: SR | null = null;
  let running = false;

  return {
    async start(onWords) {
      const Ctor = (globalThis as unknown as { webkitSpeechRecognition?: new () => SR; SpeechRecognition?: new () => SR })
        .SpeechRecognition ?? (globalThis as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition;
      if (!Ctor) throw new Error("Web Speech API unavailable — use Chrome, or the whisper sidecar");
      rec = new Ctor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";
      rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          onWords(normalizeWords(e.results[i][0].transcript));
        }
      };
      rec.onend = () => { if (running) rec?.start(); }; // auto-restart past the ~60s cap
      running = true;
      rec.start();
    },
    stop() { running = false; rec?.stop(); rec = null; },
  };
}
