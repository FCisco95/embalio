import { z } from "zod";

const seriesPoint = z.object({ date: z.string(), followers: z.number().int() });

/** AC#1 — historical (solid) + projected (dashed) follower series. */
export const Trajectory = z.object({
  history: z.array(seriesPoint),
  projected: z.array(seriesPoint),
  dailyRate: z.number(),
  r2: z.number(),
  horizonDays: z.number().int().positive(),
});
export type Trajectory = z.infer<typeof Trajectory>;

/** AC#3 — end-of-week follower prediction with a confidence band. */
export const WeeklyForecast = z.object({
  currentFollowers: z.number().int(),
  predictedFollowers: z.number().int(),
  predictedDate: z.string(),
  dailyRate: z.number(),
  low: z.number().int(),
  high: z.number().int(),
  r2: z.number(),
  basisDays: z.number().int(),
});
export type WeeklyForecast = z.infer<typeof WeeklyForecast>;

/** AC#2 — slider multipliers; 1.0 = no change. */
export const WhatIfKnobs = z.object({
  engagementRate: z.number().positive().default(1),
  followConversion: z.number().positive().default(1),
  postFrequency: z.number().positive().default(1),
});
export type WhatIfKnobs = z.infer<typeof WhatIfKnobs>;

/** AC#4 — breakout pre-check, 0-100 (mapped from the 1-7 model score). */
export const BreakoutPrecheck = z.object({
  score: z.number().int().min(0).max(100),
  band: z.enum(["weak", "medium", "strong"]),
  verdict: z.string(),
  fixes: z.array(z.string()),
});
export type BreakoutPrecheck = z.infer<typeof BreakoutPrecheck>;

/** AC#5 — the row shape persisted to public.predictions. */
export const PredictionRecord = z.object({
  type: z.enum(["trajectory", "weekly_forecast", "breakout"]),
  value_json: z.unknown(),
  created_at: z.string(),
  expires_at: z.string().nullable(),
});
export type PredictionRecord = z.infer<typeof PredictionRecord>;
