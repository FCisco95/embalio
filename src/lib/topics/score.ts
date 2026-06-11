import type { Heat } from "./heat";

export type TimingWindow = "react" | "verdict" | "saturated";

export interface WhyChips {
  niche_fit: number;   // 0-35
  heat: number;        // 0-30
  credibility: number; // 0 or 20
  timing: number;      // 0-15
}

export interface ScoreInput {
  nicheFit01: number;                    // relevanceFromVectors output
  heat: Heat;                            // from heatForTopic
  credibilityKept: boolean;              // gateTrend verdict
  freshestSourceAgeHours: number | null; // min source age; null = unparseable dates
  kind: "spike" | "durable";
}

export interface TopicScore {
  score: number; // 0-100 int
  window: TimingWindow;
  why: WhyChips;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Timing window: react (<2h news or strong fresh acceleration) /
 * verdict (24-48h take) / saturated (old or dying in our own warehouse data).
 */
function timingWindow(input: ScoreInput): TimingWindow {
  const age = input.freshestSourceAgeHours;
  const { heat } = input;
  if (age !== null && age > 48) return "saturated";
  if (heat.declining && heat.prior >= 5) return "saturated";
  if (age !== null && age <= 2) return "react";
  if (!heat.declining && heat.velocityRatio >= 3 && heat.recent >= 5) return "react";
  return "verdict";
}

const TIMING_VALUE: Record<TimingWindow, number> = { react: 1, verdict: 0.6, saturated: 0.2 };

/** Pure 0-100 scorer: niche fit 35 + heat 30 + credibility 20 + timing 15. */
export function scoreTopic(input: ScoreInput): TopicScore {
  const window = timingWindow(input);
  const why: WhyChips = {
    niche_fit: Math.round(35 * clamp01(input.nicheFit01)),
    heat: Math.round(30 * clamp01(input.heat.heat01)),
    credibility: input.credibilityKept ? 20 : 0,
    timing: Math.round(15 * TIMING_VALUE[window]),
  };
  const score = Math.max(0, Math.min(100, why.niche_fit + why.heat + why.credibility + why.timing));
  return { score, window, why };
}
