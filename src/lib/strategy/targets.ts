import type { EngagementTarget } from "@/lib/schemas";
import { StrategyTargets } from "./schemas";

const PRIORITY_RANK: Record<EngagementTarget["priority"], number> = { high: 0, medium: 1, low: 2 };

/** Rank → dedupe (by lowercased handle) → exclude → clamp recommended targets into 10–20 picks. */
export function shapeStrategyTargets(
  recommended: EngagementTarget[],
  generatedAt: string,
  opts: { max?: number; excludeHandles?: string[] } = {},
): StrategyTargets {
  const { max = 20, excludeHandles = [] } = opts;
  const exclude = new Set(excludeHandles.map((h) => h.toLowerCase()));
  const seen = new Set<string>();
  const picks: EngagementTarget[] = [];
  for (const tgt of [...recommended].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])) {
    const key = tgt.handle.toLowerCase();
    if (seen.has(key) || exclude.has(key)) continue;
    seen.add(key);
    picks.push(tgt);
    if (picks.length >= max) break;
  }
  return StrategyTargets.parse({ picks, generatedAt });
}

/**
 * Fold a per-handle seed-scan note into each pick's suggested_approach (decision #1).
 * Pure: the server action runs the buildSeedScanPrompt scan and passes the parsed
 * handle→note map; picks without a note are returned unchanged.
 */
export function mergeApproachScan(
  picks: EngagementTarget[],
  scanByHandle: Record<string, string>,
): EngagementTarget[] {
  return picks.map((p) => {
    const note = scanByHandle[p.handle];
    return note ? { ...p, suggested_approach: `${p.suggested_approach} · Recent: ${note}` } : p;
  });
}
