export interface ScoreInputs {
  relevance: number;   // 0..1 cosine similarity, already normalized
  likesPerHour: number;
  ageHours: number;
  authorFollowers?: number;        // for the 2-10x size-fit rule
  ownerFollowerEstimate?: number;  // owner's approx size (from knobs)
  replyCount?: number;             // crowding: <20 replies stays visible
  botBait?: number;                // 0..1 quality multiplier (1 clean, →0 baity)
}

export interface Scores {
  relevance: number;
  velocity: number;
  recency: number;
  composite: number;
}

const WEIGHTS = { relevance: 0.5, velocity: 0.3, recency: 0.2 };
const VELOCITY_SATURATION = 200; // likes/hr that maps to ~1.0
const RECENCY_HALFLIFE_HOURS = 12;
const REPLY_CROWD_FULL = 20;      // <= this many replies: full credit
const REPLY_CROWD_ZERO = 100;     // >= this many: no credit

// 1.0 inside the 2-10x band (playbook §4: ride out-of-network reach without
// being buried); ramps from 0 below 2x, decays toward 0 above 10x.
export function sizeFit(authorFollowers: number, ownerEstimate: number): number {
  if (ownerEstimate <= 0 || authorFollowers <= 0) return 1;
  const ratio = authorFollowers / ownerEstimate;
  if (ratio < 2) return clamp01(ratio / 2);
  if (ratio > 10) return clamp01(10 / ratio);
  return 1;
}

function crowding(replyCount: number): number {
  if (replyCount <= REPLY_CROWD_FULL) return 1;
  if (replyCount >= REPLY_CROWD_ZERO) return 0;
  return clamp01(1 - (replyCount - REPLY_CROWD_FULL) / (REPLY_CROWD_ZERO - REPLY_CROWD_FULL));
}

export function compositeScore(i: ScoreInputs): Scores {
  const relevance = clamp01(i.relevance);
  const velocity = clamp01(1 - Math.exp(-i.likesPerHour / VELOCITY_SATURATION));
  const recency = Math.pow(0.5, Math.max(0, i.ageHours) / RECENCY_HALFLIFE_HOURS);
  let composite =
    WEIGHTS.relevance * relevance +
    WEIGHTS.velocity * velocity +
    WEIGHTS.recency * recency;

  // Optional engagement-targeting multipliers (only when inputs provided).
  if (i.authorFollowers != null && i.ownerFollowerEstimate != null) {
    composite *= sizeFit(i.authorFollowers, i.ownerFollowerEstimate);
  }
  if (i.replyCount != null) {
    composite *= crowding(i.replyCount);
  }
  if (i.botBait != null) {
    composite *= clamp01(i.botBait);
  }

  return { relevance, velocity, recency, composite: clamp01(composite) };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
