import { relevanceFromVectors } from "@/lib/embeddings"; // (cosine+1)/2 → [0,1]
import { ClusterPosition } from "./schemas";

/** Mean-pool equal-length embedding vectors into a centroid. */
export function centroid(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const acc = new Array<number>(dim).fill(0);
  for (const v of vectors) for (let i = 0; i < dim; i++) acc[i] += v[i];
  return acc.map((s) => s / vectors.length);
}

export interface ClusterPositionInput {
  accountVec: number[];
  nicheVecs: number[][];
  coreThreshold?: number; // default 0.66
  edgeThreshold?: number; // default 0.40
}

/** Where the account sits vs its niche centroid, plus the niche's spread. */
export function clusterPosition(input: ClusterPositionInput): ClusterPosition {
  const { accountVec, nicheVecs, coreThreshold = 0.66, edgeThreshold = 0.40 } = input;
  const c = centroid(nicheVecs);
  const alignment = c.length && accountVec.length ? relevanceFromVectors(accountVec, c) : 0;
  const band = alignment >= coreThreshold ? "core" : alignment >= edgeThreshold ? "edge" : "outside";
  const spread = nicheVecs.length
    ? nicheVecs.reduce((s, v) => s + (1 - relevanceFromVectors(v, c)), 0) / nicheVecs.length
    : 0;
  return ClusterPosition.parse({ alignment, band, nicheSize: nicheVecs.length, spread });
}
