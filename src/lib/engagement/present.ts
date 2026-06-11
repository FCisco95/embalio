export interface FitBadge { label: string; inBand: boolean }

export function fitBadge(authorFollowers: number, ownerEstimate: number): FitBadge {
  if (!ownerEstimate || ownerEstimate <= 0 || !authorFollowers) {
    return { label: "size unknown", inBand: false };
  }
  const ratio = authorFollowers / ownerEstimate;
  if (ratio >= 5 && ratio <= 20) return { label: `${Math.round(ratio)}× your size · in band`, inBand: true };
  if (ratio > 20) return { label: "big acct · visibility play", inBand: false };
  return { label: `${ratio.toFixed(1)}× · small`, inBand: false };
}

export function freshnessLabel(createdAtIso: string, nowMs: number): string {
  const mins = Math.max(0, Math.round((nowMs - new Date(createdAtIso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)}h ago`;
}

/**
 * Dead-time queue freshness gate. Keep only candidates whose tweet is within
 * `windowH` hours — a stale queue (8-day-old posts) is worse than an empty one.
 * This is the "fresh wins" rule applied to the QUEUE, not just scan-time scoring.
 */
export const FRESH_WINDOW_H = 48;

export function isFresh(
  createdAtIso: string | undefined | null,
  nowMs: number,
  windowH = FRESH_WINDOW_H,
): boolean {
  if (!createdAtIso) return false;
  const t = new Date(createdAtIso).getTime();
  if (Number.isNaN(t)) return false;
  return nowMs - t <= windowH * 3600_000;
}
