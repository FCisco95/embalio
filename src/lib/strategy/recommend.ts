import type { EngagementTarget } from "@/lib/schemas";
import { RecommendationDeltas } from "./schemas";

export interface RecommendInput {
  picks: EngagementTarget[];                  // shaped fresh targets
  activeSeedHandles: string[];                // current active seed_targets
  activityByHandle: Record<string, number>;  // candidates surfaced per seed handle in the window
  maxDrops?: number;                          // default 5
}

/** Pure recommendation. NEVER mutates — Task 10's applyTargetRecommendation does the write, on human approval. */
export function recommendAddsDrops(input: RecommendInput): RecommendationDeltas {
  const { picks, activeSeedHandles, activityByHandle, maxDrops = 5 } = input;
  const active = new Set(activeSeedHandles.map((h) => h.toLowerCase()));
  const adds = picks.filter((p) => !active.has(p.handle.toLowerCase()));
  const drops = activeSeedHandles
    .filter((h) => (activityByHandle[h] ?? activityByHandle[h.toLowerCase()] ?? 0) === 0)
    .slice(0, maxDrops)
    .map((handle) => ({ handle, reason: "No fresh opportunities surfaced from this handle in the window." }));
  return RecommendationDeltas.parse({ adds, drops });
}
