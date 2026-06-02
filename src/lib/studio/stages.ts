import { STUDIO_STAGES, type StudioStage } from "./schemas";

const ORDER: readonly StudioStage[] = STUDIO_STAGES;

export function canTransition(from: StudioStage, to: StudioStage): boolean {
  const fi = ORDER.indexOf(from);
  const ti = ORDER.indexOf(to);
  if (fi < 0 || ti < 0) return false;
  // Forward by exactly one, or back to any earlier stage (re-edit).
  return ti === fi + 1 || ti < fi;
}

export function nextStage(from: StudioStage): StudioStage | null {
  const fi = ORDER.indexOf(from);
  return fi >= 0 && fi < ORDER.length - 1 ? ORDER[fi + 1] : null;
}
