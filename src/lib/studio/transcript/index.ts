import type { TranscriptSource } from "./types";
import { webSpeechSource } from "./web-speech";
import { whisperSidecarSource } from "./whisper-sidecar";

export type { TranscriptSource } from "./types";

/**
 * The single seam the cockpit imports. Inside Electron (the preload bridge is
 * present) the whisper sidecar is ALWAYS the source — Chromium's Web Speech
 * API doesn't work there. Browsers use NEXT_PUBLIC_TRANSCRIPT_SOURCE=whisper
 * to opt in, else the Web Speech API.
 */
export function makeTranscriptSource(): TranscriptSource {
  const inElectron = Boolean((globalThis as { embalio?: unknown }).embalio);
  const kind = process.env.NEXT_PUBLIC_TRANSCRIPT_SOURCE;
  return inElectron || kind === "whisper" ? whisperSidecarSource() : webSpeechSource();
}
