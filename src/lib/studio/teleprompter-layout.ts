import type { ChunkMode } from "./chunking";

export interface Layout {
  font: number; // pt
  opacity: number; // 0.2 .. 1
  width: number; // px
  height: number; // px
  top: number; // px
  left: number; // px
  mode: ChunkMode;
  mirror: boolean;
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
};

const RANGES = {
  font: [16, 60],
  opacity: [0.2, 1],
  width: [360, 3840],
  height: [70, 2160],
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
  };
}

export type Adjustable = "font" | "opacity" | "width" | "height";

export function adjust(l: Layout, key: Adjustable, delta: number): Layout {
  return clampLayout({ ...l, [key]: l[key] + delta });
}
