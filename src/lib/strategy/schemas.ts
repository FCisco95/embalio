import { z } from "zod";
import { EngagementTarget } from "@/lib/schemas"; // { handle, reason, priority, suggested_approach }

export const ClusterPosition = z.object({
  alignment: z.number().min(0).max(1),          // cosine(account centroid, niche centroid), [0,1]
  band: z.enum(["core", "edge", "outside"]),    // where the account sits vs its niche
  nicheSize: z.number().int().nonnegative(),    // # of niche docs used
  spread: z.number().min(0),                    // mean intra-niche distance (context)
});
export type ClusterPosition = z.infer<typeof ClusterPosition>;

export const StrategyTargets = z.object({
  picks: z.array(EngagementTarget).min(0).max(20), // aim 10–20; min 0 tolerates cold-start (UI flags thin data)
  generatedAt: z.string(),
});
export type StrategyTargets = z.infer<typeof StrategyTargets>;

export const ReplyFollowAttribution = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("insufficient_data"),
    n: z.number().int().nonnegative(),
    minN: z.number().int().positive(),
    message: z.string(),
  }),
  z.object({
    status: z.literal("correlation"),
    n: z.number().int().positive(),
    r: z.number().min(-1).max(1),
    label: z.literal("correlation"),            // hard-coded — NEVER "causation"
    disclaimer: z.string(),
  }),
]);
export type ReplyFollowAttribution = z.infer<typeof ReplyFollowAttribution>;

export const RecommendedDrop = z.object({ handle: z.string(), reason: z.string() });
export type RecommendedDrop = z.infer<typeof RecommendedDrop>;
export const RecommendationDeltas = z.object({
  adds: z.array(EngagementTarget),
  drops: z.array(RecommendedDrop),
});
export type RecommendationDeltas = z.infer<typeof RecommendationDeltas>;

export const StrategySnapshot = z.object({
  weekOf: z.string(),                            // YYYY-MM-DD (UTC Monday)
  cluster: ClusterPosition,
  targets: StrategyTargets,
  attribution: ReplyFollowAttribution,
  recommendations: RecommendationDeltas,
  generatedAt: z.string(),
});
export type StrategySnapshot = z.infer<typeof StrategySnapshot>;

export const StrategySnapshotRecord = z.object({
  profile_id: z.string(),
  week_of: z.string(),
  snapshot_json: StrategySnapshot,
});
export type StrategySnapshotRecord = z.infer<typeof StrategySnapshotRecord>;
