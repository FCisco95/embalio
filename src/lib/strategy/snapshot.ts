import { StrategySnapshot } from "./schemas";
import type { ClusterPosition, StrategyTargets, ReplyFollowAttribution, RecommendationDeltas } from "./schemas";

/** YYYY-MM-DD of the UTC Monday of the week containing `now` (ms). */
export function weekOfUTC(now: number): string {
  const d = new Date(now);
  const day = d.getUTCDay();               // 0=Sun..6=Sat
  const diff = (day + 6) % 7;              // days since Monday
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff));
  return monday.toISOString().slice(0, 10);
}

export interface SnapshotParts {
  weekOf: string;
  cluster: ClusterPosition;
  targets: StrategyTargets;
  attribution: ReplyFollowAttribution;
  recommendations: RecommendationDeltas;
  generatedAt: string;
}

export function buildStrategySnapshot(parts: SnapshotParts): StrategySnapshot {
  return StrategySnapshot.parse(parts);
}
