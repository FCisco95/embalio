import type { ChunkMode } from "./chunking";

export interface Layout {
  font: number; // pt
  opacity: number; // 0.2 .. 1
  width: number; // px
  // height is persisted-but-unused since the subtitle pill grows to fit its
  // chunk (chunk length is the real content control). Kept for data compat.
  height: number; // px
  // top/left are reserved for restoring the overlay window's on-screen position.
  // The interactive-mode drag region (-webkit-app-region: drag) moves the native
  // window, but that position is not yet round-tripped back into the layout, so
  // these fields are persisted-but-unused for now (schema-only).
  top: number; // px
  left: number; // px
  mode: ChunkMode;
  mirror: boolean;
  lines: number; // how many sentence-lines visible at once in "sent" mode
}

export const DEFAULT_LAYOUT: Layout = {
  font: 24,
  opacity: 0.7,
  width: 720,
  height: 320,
  top: 40,
  left: 40,
  mode: "para",
  mirror: false,
  lines: 2,
};

const RANGES = {
  font: [16, 60],
  opacity: [0.2, 1],
  width: [360, 3840],
  height: [70, 2160],
  lines: [1, 6],
} as const;

function clampN(v: number, [min, max]: readonly [number, number]): number {
  if (Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}

export function clampLayout(l: Layout): Layout {
  return {
    ...l,
    font: clampN(l.font, RANGES.font),
    opacity: clampN(l.opacity, RANGES.opacity),
    width: clampN(l.width, RANGES.width),
    height: clampN(l.height, RANGES.height),
    lines: clampN(l.lines, RANGES.lines),
  };
}

export type Adjustable = "font" | "opacity" | "width" | "height" | "lines";

export function adjust(l: Layout, key: Adjustable, delta: number): Layout {
  return clampLayout({ ...l, [key]: l[key] + delta });
}
