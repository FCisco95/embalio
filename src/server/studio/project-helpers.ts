import { canTransition } from "@/lib/studio/stages";
import type { StudioStage } from "@/lib/studio/schemas";

export function assertTransition(from: StudioStage, to: StudioStage) {
  if (!canTransition(from, to)) throw new Error(`cannot move from ${from} to ${to}`);
}

export function mergeProjectPatch<T extends Record<string, unknown>>(patch: T, now: string): T & { updated_at: string } {
  return { ...patch, updated_at: now };
}
