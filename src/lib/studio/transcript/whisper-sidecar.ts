import type { TranscriptSource } from "./types";
import { normalizeWords } from "./types";

/**
 * Connects to the local Whisper sidecar WebSocket (see /desktop/sidecar).
 * The sidecar emits JSON lines: { "words": "recognized text chunk" }.
 */
export function whisperSidecarSource(url = "ws://127.0.0.1:8765"): TranscriptSource {
  let ws: WebSocket | null = null;
  return {
    async start(onWords) {
      ws = new WebSocket(url);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as { words?: string };
          if (msg.words) onWords(normalizeWords(msg.words));
        } catch { /* ignore malformed frames */ }
      };
      await new Promise<void>((resolve, reject) => {
        if (!ws) return reject(new Error("no socket"));
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new Error("whisper sidecar not reachable"));
      });
    },
    stop() { ws?.close(); ws = null; },
  };
}
