import { z } from "zod";

// CSV cells arrive as strings, possibly with thousands separators ("1,234").
// Digits-only after cleanup — a malformed cell must reject the row loudly,
// never coerce to 0 (fail-loud spec rule).
const intCell = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).replace(/,/g, "").trim())
  .pipe(z.string().regex(/^\d+$/, "not a non-negative integer"))
  .transform(Number);

// One normalized day of native X analytics. date is already YYYY-MM-DD by the
// time it reaches this schema (csv.ts normalizes); visits + follows required —
// they are the whole point of the import.
export const AnalyticsDay = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  profile_visits: intCell,
  new_follows: intCell,
  unfollows: intCell.optional(),
  impressions: intCell.optional(),
  engagements: intCell.optional(),
  likes: intCell.optional(),
  replies: intCell.optional(),
  reposts: intCell.optional(),
  bookmarks: intCell.optional(),
  shares: intCell.optional(),
});
export type AnalyticsDay = z.infer<typeof AnalyticsDay>;

const point = z.object({ date: z.string(), value: z.number() });

// getKpis() output — validated at the boundary so a bad aggregate can never
// reach the UI silently. Nulls mean "no data", never 0.
export const KpiSummary = z.object({
  followsPerDay7d: z.number().nullable(),
  visitsPerDay7d: z.number().nullable(),
  followRate7d: z.number().min(0).nullable(),
  followRateBand: z.enum(["low", "good", "high"]).nullable(),
  followerCount: z.number().int().nullable(),
  followerDelta7d: z.number().int().nullable(),
  followerSeries: z.array(z.object({ date: z.string(), followers: z.number().int() })),
  visitsSeries: z.array(point),
  followsSeries: z.array(point),
  rateSeries: z.array(point),
  dataThrough: z.string().nullable(),
  lastImportAt: z.string().nullable(),
  staleDays: z.number().int().min(0).nullable(),
});
export type KpiSummary = z.infer<typeof KpiSummary>;
