/**
 * The vault target-score formula, productized (X Growth — Engagement Playbook §4):
 *
 *   score = 0.30·relevance + 0.25·reply_velocity + 0.20·recency
 *         + 0.15·size_fit(2-10x) + 0.10·followback,  × bait multiplier
 *
 * Hard drops (playbook §4 penalties): >30 replies (can't land top-5),
 * >3h old unless still visibly hot, engagement bait. Weighted-sum (not
 * multiplier) form so every part is inspectable in sniper_alerts.score_parts.
 */
export interface TargetScoreInputs {
  relevance: number;       // 0..1 (embedding similarity vs niche/voice)
  ageMinutes: number;
  replyCount: number;
  repliesPerHour: number;
  authorFollowers: number;
  ownerFollowers: number;  // real count (follower_snapshots), not bucket estimate
  bait: number;            // 0..1 from baitScore() — 1 clean, →0 baity
}

export interface TargetScoreParts {
  relevance: number;
  velocity: number;
  recency: number;
  sizeFit: number;
  followback: number;
}

export type TargetDropReason = "stale" | "crowded" | "bait";

export interface TargetScoreResult {
  score: number;                  // 0..1
  parts: TargetScoreParts;
  drop: TargetDropReason | null;  // non-null = never alert, regardless of score
}

const W = { relevance: 0.3, velocity: 0.25, recency: 0.2, sizeFit: 0.15, followback: 0.1 };
const GOLD_WINDOW_MIN = 60;       // 0-60 min is gold (full recency credit)
const STALE_MIN = 180;            // >3h = hard drop…
const HOT_REPLIES_PER_HOUR = 20;  // …unless still visibly hot
const CROWD_DROP_REPLIES = 30;    // >~30 replies: can't land top-5
const BAIT_DROP = 0.4;            // baitScore below this = farm content, skip
const VELOCITY_SATURATION = 40;   // replies/hr ≈ "20 replies in 30 min" maps near 1.0

// 2-10x band: full credit riding a bigger account's out-of-network reach.
function sniperSizeFit(authorFollowers: number, ownerFollowers: number): number {
  if (ownerFollowers <= 0 || authorFollowers <= 0) return 1; // unknown = neutral
  const ratio = authorFollowers / ownerFollowers;
  if (ratio < 2) return clamp01(ratio / 2);
  if (ratio > 10) return clamp01(10 / ratio);
  return 1;
}

// Peers (<2x) carry reciprocal-follow value; decays as the gap grows.
function followbackCredit(authorFollowers: number, ownerFollowers: number): number {
  if (ownerFollowers <= 0 || authorFollowers <= 0) return 0.5; // unknown = neutral-ish
  const ratio = authorFollowers / ownerFollowers;
  if (ratio <= 2) return 1;
  return clamp01(2 / ratio);
}

export function targetScore(i: TargetScoreInputs): TargetScoreResult {
  const parts: TargetScoreParts = {
    relevance: clamp01(i.relevance),
    velocity: clamp01(1 - Math.exp(-Math.max(0, i.repliesPerHour) / VELOCITY_SATURATION)),
    recency:
      i.ageMinutes <= GOLD_WINDOW_MIN
        ? 1
        : clamp01(1 - (i.ageMinutes - GOLD_WINDOW_MIN) / (STALE_MIN - GOLD_WINDOW_MIN)),
    sizeFit: sniperSizeFit(i.authorFollowers, i.ownerFollowers),
    followback: followbackCredit(i.authorFollowers, i.ownerFollowers),
  };

  let drop: TargetDropReason | null = null;
  if (i.replyCount > CROWD_DROP_REPLIES) drop = "crowded";
  else if (i.ageMinutes > STALE_MIN && i.repliesPerHour < HOT_REPLIES_PER_HOUR) drop = "stale";
  else if (i.bait < BAIT_DROP) drop = "bait";

  const weighted =
    W.relevance * parts.relevance +
    W.velocity * parts.velocity +
    W.recency * parts.recency +
    W.sizeFit * parts.sizeFit +
    W.followback * parts.followback;

  return { score: clamp01(weighted * clamp01(i.bait)), parts, drop };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
