import type { BreakoutScore } from "@/lib/schemas";
import { BreakoutPrecheck } from "./schemas";

/** Linear map of the model's 1-7 breakout score onto 0-100, clamped. */
export function breakoutScore0to100(score1to7: number): number {
  const clamped = Math.max(1, Math.min(7, score1to7));
  return Math.round(((clamped - 1) / 6) * 100);
}

const band = (s: number): "weak" | "medium" | "strong" => (s >= 70 ? "strong" : s >= 40 ? "medium" : "weak");

/** Compose the persisted/UI-facing pre-check from a raw model BreakoutScore. */
export function summarizeBreakout(b: BreakoutScore): BreakoutPrecheck {
  const score = breakoutScore0to100(b.score);
  return BreakoutPrecheck.parse({ score, band: band(score), verdict: b.verdict, fixes: b.fixes });
}
