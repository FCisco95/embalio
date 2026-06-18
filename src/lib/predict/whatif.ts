import { Trajectory, type WhatIfKnobs } from "./schemas";

const DAY = 86_400_000;
const utc = (date: string) => Date.parse(`${date}T00:00:00Z`);

/**
 * Re-project the trajectory under slider multipliers. Simple multiplicative model:
 * follower growth scales with engagement × follow-conversion × post-frequency.
 * Anchors on the last historical point; history is never mutated. Pure.
 */
export function applyWhatIf(base: Trajectory, knobs: WhatIfKnobs): Trajectory {
  const mult = knobs.engagementRate * knobs.followConversion * knobs.postFrequency;
  const dailyRate = base.dailyRate * mult;
  const anchor = base.history[base.history.length - 1];
  const anchorMs = utc(anchor.date);
  const projected = base.projected.map((p) => ({
    date: p.date,
    followers: Math.round(anchor.followers + dailyRate * ((utc(p.date) - anchorMs) / DAY)),
  }));
  return Trajectory.parse({ ...base, projected, dailyRate });
}
