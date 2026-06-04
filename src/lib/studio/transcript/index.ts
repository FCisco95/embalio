import type { TranscriptSource } from "./types";
import { webSpeechSource } from "./web-speech";
import { whisperSidecarSource } from "./whisper-sidecar";

export type { TranscriptSource } from "./types";

/**
 * The single seam the cockpit imports. In Electron we set
 * NEXT_PUBLIC_TRANSCRIPT_SOURCE=whisper; in a plain browser it defaults to
 * the Web Speech API.
 */
export function makeTranscriptSource(): TranscriptSource {
  const kind = process.env.NEXT_PUBLIC_TRANSCRIPT_SOURCE;
  return kind === "whisper" ? whisperSidecarSource() : webSpeechSource();
}
