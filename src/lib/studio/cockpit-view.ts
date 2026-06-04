import type { ScriptBeat } from "./schemas";

export interface CockpitView {
  current: ScriptBeat;
  next: ScriptBeat | null;
  progress: { n: number; total: number };
}

export function selectView(beats: ScriptBeat[], activeIndex: number): CockpitView {
  const total = beats.length;
  const i = Math.max(0, Math.min(activeIndex, total - 1));
  return {
    current: beats[i],
    next: i + 1 < total ? beats[i + 1] : null,
    progress: { n: i + 1, total },
  };
}
