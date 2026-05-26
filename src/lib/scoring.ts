export interface ScoreInputs {
  relevance: number;   // 0..1 cosine similarity, already normalized
  likesPerHour: number;
  ageHours: number;
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

export function compositeScore(i: ScoreInputs): Scores {
  const relevance = clamp01(i.relevance);
  const velocity = clamp01(1 - Math.exp(-i.likesPerHour / VELOCITY_SATURATION));
  const recency = Math.pow(0.5, Math.max(0, i.ageHours) / RECENCY_HALFLIFE_HOURS);
  const composite =
    WEIGHTS.relevance * relevance +
    WEIGHTS.velocity * velocity +
    WEIGHTS.recency * recency;
  return { relevance, velocity, recency, composite: clamp01(composite) };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
