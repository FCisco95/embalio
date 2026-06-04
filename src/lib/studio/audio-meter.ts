export type Band = "clip" | "hot" | "good" | "quiet";

/** Convert a 0..1 peak amplitude to dBFS, floored at -100. */
export function peakToDbfs(peak: number): number {
  if (typeof peak !== "number" || isNaN(peak) || peak <= 0) return -100;
  return Math.max(-100, 20 * Math.log10(Math.min(1, peak)));
}

/** Playbook target: speech peaks -12..-6 dB. Above -1 is clipping risk. */
export function classifyDbfs(db: number): Band {
  if (db >= -1) return "clip";
  if (db > -6) return "hot";
  if (db >= -12) return "good";
  return "quiet";
}
