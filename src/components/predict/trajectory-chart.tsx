"use client";
import type { Trajectory } from "@/lib/predict/schemas";

/** One SVG: solid line over history, dashed over the projection. Mirrors AreaChart math. */
export function TrajectoryChart({ trajectory, height = 180 }: { trajectory: Trajectory; height?: number }) {
  const all = [...trajectory.history, ...trajectory.projected];
  if (all.length < 2) return null;
  const width = 600, padT = 8, padB = 24, padX = 4;
  const innerW = width - padX * 2, innerH = height - padT - padB;
  const ys = all.map((d) => d.followers);
  const min = Math.min(...ys), max = Math.max(...ys, min + 1), range = max - min || 1;
  const xAt = (i: number) => padX + (i / (all.length - 1)) * innerW;
  const yAt = (v: number) => padT + innerH - ((v - min) / range) * innerH;
  const histPath = trajectory.history.map((d, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(d.followers)}`).join(" ");
  const lastHistIdx = trajectory.history.length - 1;
  const projPath = [trajectory.history[lastHistIdx], ...trajectory.projected]
    .map((d, i) => `${i === 0 ? "M" : "L"}${xAt(lastHistIdx + i)},${yAt(d.followers)}`).join(" ");
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <path d={histPath} fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" />
      <path d={projPath} fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="5 4" strokeOpacity="0.6" />
    </svg>
  );
}
