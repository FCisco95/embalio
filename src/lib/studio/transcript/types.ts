export interface TranscriptSource {
  /** Begin streaming. `onWords` fires with each batch of newly recognized words. */
  start(onWords: (words: string[]) => void): Promise<void>;
  stop(): void;
}

export function normalizeWords(chunk: string): string[] {
  return chunk
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
