import { PredictionRecord } from "./schemas";

const DAY = 86_400_000;

/** Pure receipt builder. ttlDays null => no expiry. Persisted verbatim to public.predictions. */
export function buildPredictionRecord(
  type: "trajectory" | "weekly_forecast" | "breakout",
  value: unknown,
  now: number,
  ttlDays: number | null,
): PredictionRecord {
  return PredictionRecord.parse({
    type,
    value_json: value,
    created_at: new Date(now).toISOString(),
    expires_at: ttlDays === null ? null : new Date(now + ttlDays * DAY).toISOString(),
  });
}
