# P4 Predictions (`src/lib/predict/`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Embalio P4 — a `src/lib/predict/` math module (trajectory projection, what-if sliders, weekly forecast, breakout 0–100 pre-check) plus a `predictions` receipts table and a forecast card on `/performance`, all persisted for accuracy backtesting.

**Architecture:** Mirror the proven `src/lib/kpis/` split — pure, deterministic math + zod schemas in `src/lib/predict/` (each `.ts` paired with a `.test.ts`), thin never-throwing result-union server actions in `src/server/predict.ts` that read the warehouse, call the pure functions, persist a receipt, and return. Reuse — never rewrite — `dedupeSnapshots` (kpis/aggregate), `buildBreakoutPrompt` + `scoreDraftBreakout` (voice-prompt/original), and the hand-rolled SVG chart idiom. What-if sliders recompute client-side off the already-fetched trajectory (no round-trip).

**Tech Stack:** Next.js 16 (App Router, server components + actions), React 19, TypeScript, zod 4, Vitest. No ML deps — EMA + ordinary least-squares linear regression by hand.

---

## Scope (the 5 acceptance criteria)

1. **Trajectory curve** — follower projection from `follower_snapshots` + `analytics_daily`. → Tasks 4, 6, 9, 10
2. **What-if sliders** — engagement rate / follow-conversion / post frequency → live trajectory impact. → Tasks 7, 10
3. **Weekly forecast** — end-of-week follower prediction (EMA + linear regression). → Tasks 4, 5, 9, 10
4. **Breakout pre-check** — draft scored 0–100 by **calling** existing `buildBreakoutPrompt()`; surfaced in draft UI. → Tasks 8, 9, 11
5. **`predictions` table** — persist every output (type, value_json, created_at, expires_at). → Tasks 2, 9

Out of scope (not in the P4 phase row): "expected-reach band per topic card" (spec §8 list but absent from the P4 deliverable row), a new `/queue` route.

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260618_predictions.sql` | `predictions` receipts table (service-role posture, RLS off — P7 hardens) |
| `src/lib/predict/schemas.ts` | zod validators + types: `Trajectory`, `WeeklyForecast`, `WhatIfKnobs`, `BreakoutPrecheck`, `PredictionRecord` |
| `src/lib/predict/regression.ts` | pure primitives `linearRegression()`, `ema()` |
| `src/lib/predict/rate.ts` | `blendedDailyRate()` (shared OLS+EMA rate, snapshot-or-fallback) + `avgDailyFollowsPerDay()` (analytics_daily fallback) |
| `src/lib/predict/forecast.ts` | `weeklyForecast()` — blended rate → end-of-week prediction + band (AC#3) |
| `src/lib/predict/trajectory.ts` | `projectTrajectory()` — historical + dashed projected series (AC#1) |
| `src/lib/predict/whatif.ts` | `applyWhatIf()` — re-project under slider multipliers (AC#2) |
| `src/lib/predict/breakout.ts` | `breakoutScore0to100()`, `summarizeBreakout()` — 1–7 → 0–100 map (AC#4) |
| `src/lib/predict/persist.ts` | `buildPredictionRecord()` — pure {type, value_json, created_at, expires_at} builder |
| `src/server/predict.ts` | thin server actions: `getForecastBundle()` (reads `follower_snapshots` + `analytics_daily` fallback rate), `precheckBreakout()` — read → compute → persist → result-union |
| `src/components/predict/trajectory-chart.tsx` | SVG: solid history + dashed projection (one chart) |
| `src/components/predict/forecast-card.tsx` | client card: chart + weekly headline + 3 what-if sliders |
| `src/components/predict/breakout-chip.tsx` | reusable 0–100 chip + verdict + fixes |
| `src/app/(app)/performance/page.tsx` | MODIFY — fetch bundle, render `<ForecastCard>` after `<KpiGrid>` |
| `src/components/thread-composer.tsx` | MODIFY — show 0–100 via `<BreakoutChip>`, persist via `precheckBreakout` |

**Naming contract (used across tasks — keep exact):** `linearRegression(points: {x:number;y:number}[]) => {slope:number; intercept:number; r2:number}` · `ema(values:number[], alpha:number) => number` · `blendedDailyRate(snaps: FollowerSnapshotRow[], fallbackDailyRate?: number｜null) => {dailyRate:number; r2:number; sigma:number} | null` · `avgDailyFollowsPerDay(rows: {new_follows:number}[]) => number | null` · `weeklyForecast(snapshots, now?, fallbackDailyRate?) => WeeklyForecast | null` · `projectTrajectory(snapshots, horizonDays, now?, fallbackDailyRate?) => Trajectory | null` · `applyWhatIf(base: Trajectory, knobs: WhatIfKnobs) => Trajectory` · `breakoutScore0to100(s:number) => number` · `summarizeBreakout(b: BreakoutScore) => BreakoutPrecheck` · `buildPredictionRecord(type, value, now, ttlDays) => PredictionRecord`.

**Data-source decision (AC#1/#3):** `follower_snapshots` is the projection basis — the only source carrying a follower-count series. `analytics_daily.new_follows` IS consumed: the server averages it (`avgDailyFollowsPerDay`) and passes it as a sparse-data **fallback daily-rate** so trajectory/forecast still work when <2 snapshots exist (early accounts). With ≥2 snapshots the snapshot fit wins; the fallback is ignored. Nothing from the AC's named inputs is silently dropped.

---

### Task 1: Merge security fix → main, cut `feat/predict-module`

**Decision (locked with owner):** fast-forward the security branch into main first, suite-green gated, then branch.

- [ ] **Step 1: Confirm suite green on the security branch (current HEAD)**

Run: `npm run test`
Expected: all green (baseline 597). If red — STOP, do not merge.

- [ ] **Step 2: Fast-forward main**

```bash
git checkout main
git merge --ff-only fix/oauth-csrf-state-postcss-vuln
```
Expected: `Fast-forward`, no merge commit.

- [ ] **Step 3: Push main (ships the OAuth-CSRF + postcss fix to prod)**

```bash
git push origin main
```

- [ ] **Step 4: Cut the feature branch**

```bash
git checkout -b feat/predict-module
```
Expected: `Switched to a new branch 'feat/predict-module'`.

**Acceptance:** `git log --oneline -1 main` shows the security commit; on `feat/predict-module`; suite green; leave untracked `src/lib/model-router.ts` alone (not part of P4).

---

### Task 2: `predictions` receipts table migration

**Files:**
- Create: `supabase/migrations/20260618_predictions.sql`

- [ ] **Step 1: Write the migration**

```sql
-- P4: prediction receipts — every trajectory / weekly-forecast / breakout output
-- is persisted here for accuracy receipts + backtesting. value_json holds the
-- full validated output (schema mirrored in src/lib/predict/schemas.ts).
-- Service-role only (RLS disabled, same posture as analytics_daily + the signal
-- warehouse; revisit in P7 hardening).
create table if not exists public.predictions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  type        text not null check (type in ('trajectory', 'weekly_forecast', 'breakout')),
  value_json  jsonb not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz
);
create index if not exists predictions_profile_type_created
  on public.predictions (profile_id, type, created_at desc);
alter table public.predictions disable row level security;
```

- [ ] **Step 2: Apply against the live project**

Use the Supabase MCP `apply_migration` tool (name: `20260618_predictions`, the SQL above). If MCP unavailable, run `supabase db push` locally.
Expected: success, no error.

- [ ] **Step 3: Verify the table exists**

Use Supabase MCP `list_tables` (schema `public`).
Expected: `predictions` present with columns id, profile_id, type, value_json, created_at, expires_at.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260618_predictions.sql
git commit -m "feat(predict): add predictions receipts table migration"
```

**Acceptance:** table live; CHECK constraint rejects unknown `type`; FK cascades on profile delete.

---

### Task 3: Predict schemas (zod)

**Files:**
- Create: `src/lib/predict/schemas.ts`
- Test: `src/lib/predict/schemas.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { Trajectory, WeeklyForecast, WhatIfKnobs, BreakoutPrecheck, PredictionRecord } from "./schemas";

describe("predict schemas", () => {
  it("accepts a valid trajectory", () => {
    const t = {
      history: [{ date: "2026-06-01", followers: 100 }],
      projected: [{ date: "2026-06-08", followers: 110 }],
      dailyRate: 1.4, r2: 0.92, horizonDays: 7,
    };
    expect(Trajectory.parse(t)).toEqual(t);
  });

  it("rejects a trajectory with a non-int follower count", () => {
    expect(() => Trajectory.parse({ history: [{ date: "2026-06-01", followers: 1.5 }], projected: [], dailyRate: 0, r2: 0, horizonDays: 7 })).toThrow();
  });

  it("defaults what-if knobs to 1.0", () => {
    expect(WhatIfKnobs.parse({})).toEqual({ engagementRate: 1, followConversion: 1, postFrequency: 1 });
  });

  it("bounds the breakout 0-100 score", () => {
    expect(() => BreakoutPrecheck.parse({ score: 101, band: "strong", verdict: "x", fixes: [] })).toThrow();
  });

  it("accepts a prediction record", () => {
    const r = { type: "weekly_forecast", value_json: { a: 1 }, created_at: "2026-06-18T00:00:00.000Z", expires_at: "2026-06-25T00:00:00.000Z" };
    expect(PredictionRecord.parse(r)).toEqual(r);
  });

  it("forecast band low <= predicted <= high is the caller's job, but shape validates", () => {
    const f = { currentFollowers: 100, predictedFollowers: 114, predictedDate: "2026-06-21", dailyRate: 2, low: 108, high: 120, r2: 0.8, basisDays: 14 };
    expect(WeeklyForecast.parse(f)).toEqual(f);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/predict/schemas.test.ts`
Expected: FAIL — `Cannot find module './schemas'`.

- [ ] **Step 3: Write the schemas**

```ts
import { z } from "zod";

const seriesPoint = z.object({ date: z.string(), followers: z.number().int() });

/** AC#1 — historical (solid) + projected (dashed) follower series. */
export const Trajectory = z.object({
  history: z.array(seriesPoint),
  projected: z.array(seriesPoint),
  dailyRate: z.number(),   // blended followers/day used for the projection
  r2: z.number(),          // regression fit quality 0..1
  horizonDays: z.number().int().positive(),
});
export type Trajectory = z.infer<typeof Trajectory>;

/** AC#3 — end-of-week follower prediction with a confidence band. */
export const WeeklyForecast = z.object({
  currentFollowers: z.number().int(),
  predictedFollowers: z.number().int(),
  predictedDate: z.string(),       // YYYY-MM-DD of end-of-week anchor
  dailyRate: z.number(),
  low: z.number().int(),           // band lower bound
  high: z.number().int(),          // band upper bound
  r2: z.number(),
  basisDays: z.number().int(),     // how many snapshot-days fed the fit
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/predict/schemas.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/predict/schemas.ts src/lib/predict/schemas.test.ts
git commit -m "feat(predict): zod schemas for predict outputs"
```

**Acceptance:** all five schemas parse valid shapes and reject the invariants tested; `WhatIfKnobs.parse({})` yields all-1.0.

---

### Task 4: Regression, EMA + blended daily-rate

**Files:**
- Create: `src/lib/predict/regression.ts`
- Test: `src/lib/predict/regression.test.ts`
- Create: `src/lib/predict/rate.ts`
- Test: `src/lib/predict/rate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { linearRegression, ema } from "./regression";

describe("linearRegression", () => {
  it("fits a perfect line: y = 2x + 1, r2 = 1", () => {
    const r = linearRegression([{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }]);
    expect(r.slope).toBeCloseTo(2, 10);
    expect(r.intercept).toBeCloseTo(1, 10);
    expect(r.r2).toBeCloseTo(1, 10);
  });

  it("returns slope 0 and r2 0 for flat data", () => {
    const r = linearRegression([{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }]);
    expect(r.slope).toBeCloseTo(0, 10);
    expect(r.r2).toBe(0); // SStot 0 -> defined as 0, never NaN
  });

  it("throws on fewer than two points", () => {
    expect(() => linearRegression([{ x: 0, y: 1 }])).toThrow();
  });
});

describe("ema", () => {
  it("equals the single value for one element", () => {
    expect(ema([10], 0.5)).toBe(10);
  });

  it("weights recent values: alpha 1 returns the last value", () => {
    expect(ema([1, 2, 99], 1)).toBe(99);
  });

  it("computes the recurrence for alpha 0.5", () => {
    // seed=2 -> 0.5*4+0.5*2=3 -> 0.5*6+0.5*3=4.5
    expect(ema([2, 4, 6], 0.5)).toBeCloseTo(4.5, 10);
  });

  it("throws on empty input", () => {
    expect(() => ema([], 0.5)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/predict/regression.test.ts`
Expected: FAIL — `Cannot find module './regression'`.

- [ ] **Step 3: Write the implementation**

```ts
export interface Fit {
  slope: number;
  intercept: number;
  r2: number;
}

/** Ordinary least-squares fit. Throws on <2 points. r2 is 0 (not NaN) when y is flat. */
export function linearRegression(points: { x: number; y: number }[]): Fit {
  const n = points.length;
  if (n < 2) throw new Error("linearRegression needs at least 2 points");
  const xBar = points.reduce((s, p) => s + p.x, 0) / n;
  const yBar = points.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of points) {
    const dx = p.x - xBar, dy = p.y - yBar;
    sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = yBar - slope * xBar;
  // SSres = Σ(y - ŷ)²; r2 = 1 - SSres/SStot. Flat y (syy 0) -> r2 0 by definition.
  let ssres = 0;
  for (const p of points) { const e = p.y - (slope * p.x + intercept); ssres += e * e; }
  const r2 = syy === 0 ? 0 : Math.max(0, 1 - ssres / syy);
  return { slope, intercept, r2 };
}

/** Exponential moving average. alpha in (0,1]; throws on empty input. */
export function ema(values: number[], alpha: number): number {
  if (values.length === 0) throw new Error("ema needs at least 1 value");
  let acc = values[0];
  for (let i = 1; i < values.length; i++) acc = alpha * values[i] + (1 - alpha) * acc;
  return acc;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/predict/regression.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/predict/regression.ts src/lib/predict/regression.test.ts
git commit -m "feat(predict): least-squares regression + EMA primitives"
```

- [ ] **Step 6: Write the failing test for the shared rate helper**

```ts
import { describe, it, expect } from "vitest";
import { blendedDailyRate, avgDailyFollowsPerDay } from "./rate";

const snap = (date: string, followers: number) => ({ snapshot_date: date, followers });

describe("blendedDailyRate", () => {
  it("returns null for an empty series and no fallback", () => {
    expect(blendedDailyRate([], null)).toBeNull();
  });

  it("returns the fallback (r2 0, sigma 0) when fewer than two snapshots", () => {
    expect(blendedDailyRate([snap("2026-06-16", 100)], 3)).toEqual({ dailyRate: 3, r2: 0, sigma: 0 });
  });

  it("returns null with one snapshot and no fallback", () => {
    expect(blendedDailyRate([snap("2026-06-16", 100)], null)).toBeNull();
  });

  it("blends OLS slope + EMA deltas on a steady +2/day series", () => {
    const snaps = Array.from({ length: 5 }, (_, i) =>
      snap(`2026-06-${String(10 + i).padStart(2, "0")}`, 100 + i * 2));
    const rf = blendedDailyRate(snaps, null)!;
    expect(rf.dailyRate).toBeCloseTo(2, 10); // slope 2, all deltas 2 -> (2+2)/2
    expect(rf.r2).toBeCloseTo(1, 10);
    expect(rf.sigma).toBeCloseTo(0, 10);
  });
});

describe("avgDailyFollowsPerDay", () => {
  it("is null for no rows", () => {
    expect(avgDailyFollowsPerDay([])).toBeNull();
  });
  it("averages new_follows over the rows", () => {
    expect(avgDailyFollowsPerDay([{ new_follows: 2 }, { new_follows: 4 }])).toBe(3);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run src/lib/predict/rate.test.ts`
Expected: FAIL — `Cannot find module './rate'`.

- [ ] **Step 8: Write the shared rate helper**

```ts
import { type FollowerSnapshotRow } from "@/lib/kpis/aggregate";
import { linearRegression, ema } from "./regression";

const DAY = 86_400_000;
const utc = (date: string) => Date.parse(`${date}T00:00:00Z`);

export interface RateFit {
  dailyRate: number; // followers/day used for projection
  r2: number;        // fit quality 0..1 (0 on the fallback path)
  sigma: number;     // residual stddev for the band (0 on the fallback path)
}

/**
 * Blended daily follower-growth rate from a follower-snapshot series. snaps must be
 * deduped + sorted ascending (pass dedupeSnapshots output).
 * - ≥2 snapshots: (OLS slope + EMA of daily deltas) / 2, with fit r2 + residual sigma.
 * - <2 snapshots: falls back to fallbackDailyRate (e.g. avg new_follows/day from
 *   analytics_daily); r2 + sigma are 0 (no fit, no band).
 * - null when neither path yields a rate.
 */
export function blendedDailyRate(snaps: FollowerSnapshotRow[], fallbackDailyRate: number | null = null): RateFit | null {
  if (snaps.length >= 2) {
    const d0 = utc(snaps[0].snapshot_date);
    const points = snaps.map((s) => ({ x: (utc(s.snapshot_date) - d0) / DAY, y: s.followers }));
    const fit = linearRegression(points);
    const deltas = snaps.slice(1).map((s, i) => s.followers - snaps[i].followers);
    const dailyRate = (fit.slope + ema(deltas, 0.5)) / 2;
    const resid = points.map((p) => p.y - (fit.slope * p.x + fit.intercept));
    const sigma = Math.sqrt(resid.reduce((s, e) => s + e * e, 0) / resid.length);
    return { dailyRate, r2: fit.r2, sigma };
  }
  if (fallbackDailyRate !== null) return { dailyRate: fallbackDailyRate, r2: 0, sigma: 0 };
  return null;
}

/** Avg new_follows/day from analytics_daily rows — the sparse-data fallback rate. Null when empty. */
export function avgDailyFollowsPerDay(rows: { new_follows: number }[]): number | null {
  if (rows.length === 0) return null;
  return rows.reduce((s, r) => s + r.new_follows, 0) / rows.length;
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run src/lib/predict/rate.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 10: Commit**

```bash
git add src/lib/predict/rate.ts src/lib/predict/rate.test.ts
git commit -m "feat(predict): shared blended daily-rate + analytics_daily fallback"
```

**Acceptance:** perfect line → r2 1; flat data → slope 0, r2 0 (never NaN); both regression fns throw on degenerate input. `blendedDailyRate` blends on ≥2 snaps, falls back on <2, null when neither; `avgDailyFollowsPerDay` averages new_follows.

---

### Task 5: Weekly forecast (AC#3)

**Files:**
- Create: `src/lib/predict/forecast.ts`
- Test: `src/lib/predict/forecast.test.ts`

**Reuse:** `dedupeSnapshots` + `FollowerSnapshotRow` from `@/lib/kpis/aggregate` (one snapshot/day, sorted ascending).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { weeklyForecast, endOfWeekUTC } from "./forecast";

const snap = (date: string, followers: number) => ({ snapshot_date: date, followers });
// Wed 2026-06-17 12:00Z
const NOW = Date.parse("2026-06-17T12:00:00Z");

describe("endOfWeekUTC", () => {
  it("rolls forward to the upcoming Sunday (YYYY-MM-DD)", () => {
    expect(endOfWeekUTC(NOW)).toBe("2026-06-21");
  });
});

describe("weeklyForecast", () => {
  it("returns null with fewer than two snapshots and no fallback", () => {
    expect(weeklyForecast([snap("2026-06-16", 100)], NOW)).toBeNull();
  });

  it("uses the analytics_daily fallback rate with a single snapshot", () => {
    // 1 snapshot on the 16th @ 100, fallback +5/day, 5 days to Sunday the 21st
    const f = weeklyForecast([snap("2026-06-16", 100)], NOW, 5)!;
    expect(f.currentFollowers).toBe(100);
    expect(f.dailyRate).toBe(5);
    expect(f.predictedFollowers).toBe(125);
    expect(f.low).toBe(125); // sigma 0 on the fallback path -> no band spread
    expect(f.high).toBe(125);
    expect(f.basisDays).toBe(1);
  });

  it("projects a steady +2/day series to end of week", () => {
    const snaps = Array.from({ length: 8 }, (_, i) =>
      snap(`2026-06-${String(10 + i).padStart(2, "0")}`, 100 + i * 2)); // 10th..17th, 100..114
    const f = weeklyForecast(snaps, NOW)!;
    expect(f.currentFollowers).toBe(114);
    expect(f.dailyRate).toBeCloseTo(2, 1);
    // 4 days from 17th to 21st -> ~114 + 8
    expect(f.predictedFollowers).toBe(122);
    expect(f.predictedDate).toBe("2026-06-21");
    expect(f.low).toBeLessThanOrEqual(f.predictedFollowers);
    expect(f.high).toBeGreaterThanOrEqual(f.predictedFollowers);
    expect(f.basisDays).toBe(8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/predict/forecast.test.ts`
Expected: FAIL — `Cannot find module './forecast'`.

- [ ] **Step 3: Write the implementation**

```ts
import { dedupeSnapshots, type FollowerSnapshotRow } from "@/lib/kpis/aggregate";
import { blendedDailyRate } from "./rate";
import { WeeklyForecast } from "./schemas";

const DAY = 86_400_000;
const utc = (date: string) => Date.parse(`${date}T00:00:00Z`);

/** YYYY-MM-DD of the upcoming Sunday (UTC). Sunday itself rolls to next Sunday. */
export function endOfWeekUTC(now: number): string {
  const d = new Date(now);
  const dow = d.getUTCDay();               // 0=Sun
  const add = dow === 0 ? 7 : 7 - dow;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + add)).toISOString().slice(0, 10);
}

/**
 * End-of-week follower prediction. Rate = blendedDailyRate (OLS slope + EMA of
 * day-over-day deltas, or the analytics_daily fallback when snapshots are sparse).
 * Null when no anchor snapshot or no rate (nulls mean "no data", never 0).
 * Band = ±1σ of fit residuals (0 on the fallback path).
 */
export function weeklyForecast(
  rows: FollowerSnapshotRow[],
  now: number = Date.now(),
  fallbackDailyRate: number | null = null,
): WeeklyForecast | null {
  const snaps = dedupeSnapshots(rows);
  if (snaps.length === 0) return null;                 // no anchor
  const rf = blendedDailyRate(snaps, fallbackDailyRate);
  if (!rf) return null;                                // 1 snapshot, no fallback

  const latest = snaps[snaps.length - 1];
  const targetDate = endOfWeekUTC(now);
  const daysAhead = Math.max(0, Math.round((utc(targetDate) - utc(latest.snapshot_date)) / DAY));
  const predicted = latest.followers + rf.dailyRate * daysAhead;

  return WeeklyForecast.parse({
    currentFollowers: latest.followers,
    predictedFollowers: Math.round(predicted),
    predictedDate: targetDate,
    dailyRate: rf.dailyRate,
    low: Math.round(predicted - rf.sigma),
    high: Math.round(predicted + rf.sigma),
    r2: rf.r2,
    basisDays: snaps.length,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/predict/forecast.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/predict/forecast.ts src/lib/predict/forecast.test.ts
git commit -m "feat(predict): weekly forecast (blended rate + analytics_daily fallback)"
```

**Acceptance:** null with no anchor or no rate; steady +2/day → dailyRate≈2, end-of-week prediction on the upcoming Sunday with low ≤ predicted ≤ high; single snapshot + fallback rate still forecasts (basisDays 1, no band).

---

### Task 6: Trajectory projection (AC#1)

**Files:**
- Create: `src/lib/predict/trajectory.ts`
- Test: `src/lib/predict/trajectory.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { projectTrajectory } from "./trajectory";

const snap = (date: string, followers: number) => ({ snapshot_date: date, followers });

describe("projectTrajectory", () => {
  it("returns null with fewer than two snapshots", () => {
    expect(projectTrajectory([snap("2026-06-16", 100)], 7)).toBeNull();
  });

  it("extends a +2/day history by horizonDays from the last actual", () => {
    const snaps = Array.from({ length: 5 }, (_, i) =>
      snap(`2026-06-${String(10 + i).padStart(2, "0")}`, 100 + i * 2)); // 100..108
    const t = projectTrajectory(snaps, 7)!;
    expect(t.history).toHaveLength(5);
    expect(t.history[4]).toEqual({ date: "2026-06-14", followers: 108 });
    expect(t.dailyRate).toBeCloseTo(2, 1);
    // projected[0] anchors on the last actual day+1, runs horizonDays
    expect(t.projected).toHaveLength(7);
    expect(t.projected[0].date).toBe("2026-06-15");
    expect(t.projected[6].followers).toBe(122); // 108 + 7*2
    expect(t.horizonDays).toBe(7);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/predict/trajectory.test.ts`
Expected: FAIL — `Cannot find module './trajectory'`.

- [ ] **Step 3: Write the implementation**

```ts
import { dedupeSnapshots, type FollowerSnapshotRow } from "@/lib/kpis/aggregate";
import { blendedDailyRate } from "./rate";
import { Trajectory } from "./schemas";

const DAY = 86_400_000;
const utc = (date: string) => Date.parse(`${date}T00:00:00Z`);
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Historical follower series (solid) + a horizonDays projection (dashed) using the
 * same blendedDailyRate as weeklyForecast (snapshot fit, or analytics_daily fallback
 * when sparse). projected starts the day AFTER the last actual so the dashed segment
 * connects cleanly. Null when no anchor snapshot or no rate.
 */
export function projectTrajectory(
  rows: FollowerSnapshotRow[],
  horizonDays: number,
  _now: number = Date.now(),
  fallbackDailyRate: number | null = null,
): Trajectory | null {
  const snaps = dedupeSnapshots(rows);
  if (snaps.length === 0) return null;
  const rf = blendedDailyRate(snaps, fallbackDailyRate);
  if (!rf) return null;

  const last = snaps[snaps.length - 1];
  const lastMs = utc(last.snapshot_date);
  const projected = Array.from({ length: horizonDays }, (_, i) => ({
    date: isoDay(lastMs + (i + 1) * DAY),
    followers: Math.round(last.followers + rf.dailyRate * (i + 1)),
  }));

  return Trajectory.parse({
    history: snaps.map((s) => ({ date: s.snapshot_date, followers: s.followers })),
    projected,
    dailyRate: rf.dailyRate,
    r2: rf.r2,
    horizonDays,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/predict/trajectory.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/predict/trajectory.ts src/lib/predict/trajectory.test.ts
git commit -m "feat(predict): follower trajectory projection"
```

**Acceptance:** null with no anchor or no rate; history preserved; projected has exactly horizonDays points, starts last-day+1, follows the blended rate (or fallback when sparse).

---

### Task 7: What-if adjustment (AC#2)

**Files:**
- Create: `src/lib/predict/whatif.ts`
- Test: `src/lib/predict/whatif.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { applyWhatIf } from "./whatif";
import type { Trajectory } from "./schemas";

const base: Trajectory = {
  history: [{ date: "2026-06-13", followers: 100 }, { date: "2026-06-14", followers: 108 }],
  projected: [
    { date: "2026-06-15", followers: 110 },
    { date: "2026-06-16", followers: 112 },
  ],
  dailyRate: 2, r2: 1, horizonDays: 2,
};

describe("applyWhatIf", () => {
  it("is identity when all knobs are 1.0", () => {
    const out = applyWhatIf(base, { engagementRate: 1, followConversion: 1, postFrequency: 1 });
    expect(out.projected).toEqual(base.projected);
    expect(out.dailyRate).toBe(2);
  });

  it("doubles the projected rate when the combined multiplier is 2x", () => {
    // 2 * 1 * 1 = 2x rate -> 4/day from anchor 108
    const out = applyWhatIf(base, { engagementRate: 2, followConversion: 1, postFrequency: 1 });
    expect(out.dailyRate).toBe(4);
    expect(out.projected[0].followers).toBe(112); // 108 + 4*1
    expect(out.projected[1].followers).toBe(116); // 108 + 4*2
  });

  it("leaves history untouched", () => {
    const out = applyWhatIf(base, { engagementRate: 0.5, followConversion: 1, postFrequency: 1 });
    expect(out.history).toEqual(base.history);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/predict/whatif.test.ts`
Expected: FAIL — `Cannot find module './whatif'`.

- [ ] **Step 3: Write the implementation**

```ts
import { Trajectory, type WhatIfKnobs } from "./schemas";

const DAY = 86_400_000;
const utc = (date: string) => Date.parse(`${date}T00:00:00Z`);

/**
 * Re-project the trajectory under slider multipliers. Simple multiplicative model:
 * follower growth scales with engagement × follow-conversion × post-frequency.
 * Anchors on the last historical point; history is never mutated. Pure.
 */
export function applyWhatIf(base: Trajectory, knobs: WhatIfKnobs): Trajectory {
  const mult = knobs.engagementRate * knobs.followConversion * knobs.postFrequency;
  const dailyRate = base.dailyRate * mult;
  const anchor = base.history[base.history.length - 1];
  const anchorMs = utc(anchor.date);
  const projected = base.projected.map((p, i) => ({
    date: p.date,
    followers: Math.round(anchor.followers + dailyRate * ((utc(p.date) - anchorMs) / DAY)),
  }));
  return Trajectory.parse({ ...base, projected, dailyRate });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/predict/whatif.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/predict/whatif.ts src/lib/predict/whatif.test.ts
git commit -m "feat(predict): what-if slider re-projection"
```

**Acceptance:** identity at all-1.0; combined multiplier scales the rate; history immutable.

---

### Task 8: Breakout 0–100 mapper (AC#4 math)

**Files:**
- Create: `src/lib/predict/breakout.ts`
- Test: `src/lib/predict/breakout.test.ts`

**Reuse:** consumes the existing `BreakoutScore` (1–7) from `@/lib/schemas`. Does NOT call the model or touch `buildBreakoutPrompt`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { breakoutScore0to100, summarizeBreakout } from "./breakout";

describe("breakoutScore0to100", () => {
  it("maps the 1-7 scale onto 0-100 endpoints", () => {
    expect(breakoutScore0to100(1)).toBe(0);
    expect(breakoutScore0to100(4)).toBe(50);
    expect(breakoutScore0to100(7)).toBe(100);
  });
  it("clamps out-of-range model output", () => {
    expect(breakoutScore0to100(0)).toBe(0);
    expect(breakoutScore0to100(9)).toBe(100);
  });
});

describe("summarizeBreakout", () => {
  it("bands and carries verdict + fixes through", () => {
    const out = summarizeBreakout({ score: 6, verdict: "hook is strong", hook_strength: "strong", fixes: ["add a number"] });
    expect(out).toEqual({ score: 83, band: "strong", verdict: "hook is strong", fixes: ["add a number"] });
  });
  it("bands a weak draft", () => {
    expect(summarizeBreakout({ score: 2, verdict: "noise", hook_strength: "weak", fixes: [] }).band).toBe("weak");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/predict/breakout.test.ts`
Expected: FAIL — `Cannot find module './breakout'`.

- [ ] **Step 3: Write the implementation**

```ts
import type { BreakoutScore } from "@/lib/schemas";
import { BreakoutPrecheck } from "./schemas";

/** Linear map of the model's 1-7 breakout score onto 0-100, clamped. */
export function breakoutScore0to100(score1to7: number): number {
  const clamped = Math.max(1, Math.min(7, score1to7));
  return Math.round(((clamped - 1) / 6) * 100);
}

const band = (s: number): "weak" | "medium" | "strong" => (s >= 70 ? "strong" : s >= 40 ? "medium" : "weak");

/** Compose the persisted/UI-facing pre-check from a raw model BreakoutScore. */
export function summarizeBreakout(b: BreakoutScore): BreakoutPrecheck {
  const score = breakoutScore0to100(b.score);
  return BreakoutPrecheck.parse({ score, band: band(score), verdict: b.verdict, fixes: b.fixes });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/predict/breakout.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/predict/breakout.ts src/lib/predict/breakout.test.ts
git commit -m "feat(predict): breakout 1-7 -> 0-100 mapper"
```

**Acceptance:** 1→0, 4→50, 7→100; clamps; bands at 40/70; verdict + fixes preserved.

---

### Task 9: Persistence helper + server actions (AC#5 + wiring)

**Files:**
- Create: `src/lib/predict/persist.ts`
- Test: `src/lib/predict/persist.test.ts`
- Create: `src/server/predict.ts` (thin, no unit test — DB I/O covered by the Task 12 dogfood, matching `src/server/kpis.ts`)

- [ ] **Step 1: Write the failing test for the pure record builder**

```ts
import { describe, it, expect } from "vitest";
import { buildPredictionRecord } from "./persist";

const NOW = Date.parse("2026-06-18T00:00:00Z");

describe("buildPredictionRecord", () => {
  it("stamps created_at and a ttl-based expires_at", () => {
    const r = buildPredictionRecord("weekly_forecast", { predictedFollowers: 120 }, NOW, 7);
    expect(r.type).toBe("weekly_forecast");
    expect(r.value_json).toEqual({ predictedFollowers: 120 });
    expect(r.created_at).toBe("2026-06-18T00:00:00.000Z");
    expect(r.expires_at).toBe("2026-06-25T00:00:00.000Z");
  });

  it("null expires_at when ttlDays is null", () => {
    const r = buildPredictionRecord("breakout", { score: 80 }, NOW, null);
    expect(r.expires_at).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/predict/persist.test.ts`
Expected: FAIL — `Cannot find module './persist'`.

- [ ] **Step 3: Write the pure builder**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/predict/persist.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the server actions (thin, result-union, never throw)**

```ts
"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { weeklyForecast } from "@/lib/predict/forecast";
import { projectTrajectory } from "@/lib/predict/trajectory";
import { summarizeBreakout } from "@/lib/predict/breakout";
import { avgDailyFollowsPerDay } from "@/lib/predict/rate";
import { buildPredictionRecord } from "@/lib/predict/persist";
import { scoreDraftBreakout } from "@/server/original";
import type { Trajectory, WeeklyForecast, BreakoutPrecheck } from "@/lib/predict/schemas";

const SNAPSHOT_WINDOW_DAYS = 45;
const HORIZON_DAYS = 14;
const sinceDate = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

async function readSnapshots(sb: Awaited<ReturnType<typeof supabaseServer>>, profileId: string) {
  const { data, error } = await sb
    .from("follower_snapshots")
    .select("snapshot_date, followers, captured_at")
    .eq("profile_id", profileId)
    .gte("snapshot_date", sinceDate(SNAPSHOT_WINDOW_DAYS))
    .order("snapshot_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as { snapshot_date: string; followers: number; captured_at?: string | null }[];
}

// analytics_daily.new_follows feeds the sparse-data fallback rate (AC#1/#3 input).
async function readDailyFollows(sb: Awaited<ReturnType<typeof supabaseServer>>, profileId: string) {
  const { data, error } = await sb
    .from("analytics_daily")
    .select("date, new_follows")
    .eq("profile_id", profileId)
    .gte("date", sinceDate(SNAPSHOT_WINDOW_DAYS))
    .order("date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as { date: string; new_follows: number }[];
}

export type ForecastBundle =
  | { ok: true; trajectory: Trajectory | null; forecast: WeeklyForecast | null }
  | { ok: false; error: string };

/** Trajectory + weekly forecast for the /performance card. Persists both receipts. Never throws. */
export async function getForecastBundle(profileId: string): Promise<ForecastBundle> {
  if (!profileId) return { ok: false, error: "no profile" };
  try {
    const sb = await supabaseServer();
    const [snaps, daily] = await Promise.all([readSnapshots(sb, profileId), readDailyFollows(sb, profileId)]);
    const now = Date.now();
    const fallback = avgDailyFollowsPerDay(daily); // null when no analytics_daily rows
    const trajectory = projectTrajectory(snaps, HORIZON_DAYS, now, fallback);
    const forecast = weeklyForecast(snaps, now, fallback);
    const rows = [
      trajectory && buildPredictionRecord("trajectory", trajectory, now, HORIZON_DAYS),
      forecast && buildPredictionRecord("weekly_forecast", forecast, now, 7),
    ].filter(Boolean).map((r) => ({ profile_id: profileId, ...r! }));
    if (rows.length) await sb.from("predictions").insert(rows);
    return { ok: true, trajectory, forecast };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export type BreakoutResult = { ok: true; precheck: BreakoutPrecheck } | { ok: false; error: string };

/** AC#4: call the existing prompt -> 0-100 -> persist. Never throws. */
export async function precheckBreakout(profileId: string, draft: string): Promise<BreakoutResult> {
  if (!profileId) return { ok: false, error: "no profile" };
  try {
    const raw = await scoreDraftBreakout(draft); // reuses buildBreakoutPrompt — do NOT rewrite
    const precheck = summarizeBreakout(raw);
    const sb = await supabaseServer();
    await sb.from("predictions").insert({ profile_id: profileId, ...buildPredictionRecord("breakout", precheck, Date.now(), 30) });
    return { ok: true, precheck };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
```

- [ ] **Step 6: Typecheck + full suite**

Run: `npx tsc --noEmit && npm run test`
Expected: no TS errors; suite green (597 + new predict tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/predict/persist.ts src/lib/predict/persist.test.ts src/server/predict.ts
git commit -m "feat(predict): prediction receipts + forecast/breakout server actions"
```

**Acceptance:** `buildPredictionRecord` stamps created/expires correctly; server actions return result-unions, never throw; `getForecastBundle` reads the 45-day `follower_snapshots` window like `getKpis` AND `analytics_daily` for the fallback rate; every output writes a `predictions` row; breakout reuses `scoreDraftBreakout`.

---

### Task 10: ForecastCard + TrajectoryChart + what-if sliders (AC#1/2/3 UI)

**Files:**
- Create: `src/components/predict/trajectory-chart.tsx`
- Create: `src/components/predict/forecast-card.tsx`
- Modify: `src/app/(app)/performance/page.tsx`

- [ ] **Step 1: Write the TrajectoryChart (solid history + dashed projection)**

```tsx
"use client";
import type { Trajectory } from "@/lib/predict/schemas";

/** One SVG: solid line over history, dashed over the projection. Mirrors AreaChart math. */
export function TrajectoryChart({ trajectory, height = 180 }: { trajectory: Trajectory; height?: number }) {
  const all = [...trajectory.history, ...trajectory.projected];
  if (all.length < 2) return null;
  const width = 600, padT = 8, padB = 24, padX = 4;
  const innerW = width - padX * 2, innerH = height - padT - padB;
  const ys = all.map((d) => d.followers);
  const min = Math.min(...ys), max = Math.max(...ys, min + 1), range = max - min || 1;
  const xAt = (i: number) => padX + (i / (all.length - 1)) * innerW;
  const yAt = (v: number) => padT + innerH - ((v - min) / range) * innerH;
  const path = (pts: { followers: number }[], offset: number) =>
    pts.map((d, i) => `${i === 0 ? "M" : "L"}${xAt(offset + i)},${yAt(d.followers)}`).join(" ");
  const histPath = path(trajectory.history, 0);
  // projection path begins at the last history point so the dashes connect
  const lastHistIdx = trajectory.history.length - 1;
  const projPath = [trajectory.history[lastHistIdx], ...trajectory.projected]
    .map((d, i) => `${i === 0 ? "M" : "L"}${xAt(lastHistIdx + i)},${yAt(d.followers)}`).join(" ");
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <path d={histPath} fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" />
      <path d={projPath} fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="5 4" strokeOpacity="0.6" />
    </svg>
  );
}
```

- [ ] **Step 2: Write the ForecastCard (sliders recompute client-side via applyWhatIf)**

```tsx
"use client";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { applyWhatIf } from "@/lib/predict/whatif";
import { TrajectoryChart } from "./trajectory-chart";
import type { Trajectory, WeeklyForecast } from "@/lib/predict/schemas";

const SLIDERS = [
  { key: "engagementRate", label: "Engagement rate" },
  { key: "followConversion", label: "Follow conversion" },
  { key: "postFrequency", label: "Post frequency" },
] as const;

export function ForecastCard({ trajectory, forecast }: { trajectory: Trajectory | null; forecast: WeeklyForecast | null }) {
  const [knobs, setKnobs] = useState({ engagementRate: 1, followConversion: 1, postFrequency: 1 });
  const adjusted = useMemo(() => (trajectory ? applyWhatIf(trajectory, knobs) : null), [trajectory, knobs]);
  if (!trajectory) {
    return (
      <Card>
        <CardHeader><CardTitle>Forecast</CardTitle></CardHeader>
        <CardContent className="text-[13px] text-muted-foreground">Need at least two follower snapshots to project a trajectory.</CardContent>
      </Card>
    );
  }
  const endValue = adjusted!.projected[adjusted!.projected.length - 1]?.followers ?? forecast?.predictedFollowers;
  return (
    <Card>
      <CardHeader><CardTitle>Forecast</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {forecast && (
          <div>
            <div className="text-[26px] font-bold tabular-nums tracking-[-0.02em]">{forecast.predictedFollowers.toLocaleString()}</div>
            <div className="text-[12px] text-muted-foreground">predicted by {forecast.predictedDate} · band {forecast.low.toLocaleString()}–{forecast.high.toLocaleString()}</div>
          </div>
        )}
        <TrajectoryChart trajectory={adjusted!} />
        <div className="space-y-3">
          {SLIDERS.map(({ key, label }) => (
            <label key={key} className="block text-[12px]">
              <span className="text-muted-foreground">{label}: {knobs[key].toFixed(2)}×</span>
              <input
                type="range" min={0.5} max={2} step={0.05} value={knobs[key]}
                onChange={(e) => setKnobs((k) => ({ ...k, [key]: Number(e.target.value) }))}
                className="w-full"
              />
            </label>
          ))}
          <div className="text-[13px]">What-if end of horizon: <span className="font-semibold tabular-nums">{endValue?.toLocaleString() ?? "—"}</span></div>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Wire into the performance page**

In `src/app/(app)/performance/page.tsx`: add imports and fetch, render `<ForecastCard>` right after the `{kpis && <KpiGrid kpis={kpis} />}` block.

```tsx
// add near the other imports
import { getForecastBundle } from "@/server/predict";
import { ForecastCard } from "@/components/predict/forecast-card";

// add after `const kpis = active ? await getKpis(active) : null;`
const bundle = active ? await getForecastBundle(active) : null;

// add inside the JSX, immediately after the KpiGrid line:
{bundle?.ok && <ForecastCard trajectory={bundle.trajectory} forecast={bundle.forecast} />}
```

- [ ] **Step 4: Typecheck + build + smoke**

Run: `npx tsc --noEmit && npm run build`
Expected: compiles. Then `npm run dev`, open `http://localhost:3000/performance` — card renders, sliders move the dashed line + the "what-if end of horizon" number live.

- [ ] **Step 5: Commit**

```bash
git add src/components/predict/ "src/app/(app)/performance/page.tsx"
git commit -m "feat(predict): forecast card with trajectory chart + what-if sliders"
```

**Acceptance:** card on /performance shows weekly headline + band, solid history + dashed projection; moving any slider redraws live with no server round-trip; graceful "need two snapshots" empty state.

---

### Task 11: BreakoutChip + wire into thread-composer (AC#4 UI)

**Files:**
- Create: `src/components/predict/breakout-chip.tsx`
- Modify: `src/components/thread-composer.tsx`

- [ ] **Step 1: Write the BreakoutChip**

```tsx
import type { BreakoutPrecheck } from "@/lib/predict/schemas";

const BAND: Record<BreakoutPrecheck["band"], string> = {
  strong: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  weak: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

/** 0-100 breakout pre-check chip + verdict + fixes. */
export function BreakoutChip({ precheck }: { precheck: BreakoutPrecheck }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium ${BAND[precheck.band]}`}>
          Breakout {precheck.score}/100
        </span>
        <span className="text-[12px] text-muted-foreground">{precheck.verdict}</span>
      </div>
      {precheck.fixes.length > 0 && (
        <ul className="list-disc pl-5 text-[12px] text-muted-foreground">
          {precheck.fixes.map((f, i) => <li key={i}>{f}</li>)}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Repoint the breakout check at the 0–100 server action**

**Where the code actually is (verified):** the breakout button, `scoreDraftBreakout` call, `score` state, and `ScoreBadge` (1–7) all live in the inner `TweetCard` sub-component (`thread-composer.tsx:24–78`), NOT in `ThreadComposer`. `profileId` already exists in `ThreadComposer`'s own state (`:81`) but is NOT passed down to `TweetCard` (`:145`). So the change is: (a) thread `profileId` from `ThreadComposer` into each `<TweetCard>`, and (b) swap the call/state/display inside `TweetCard`. `ThreadComposer` needs NO new prop — its parent (`compose/page.tsx`) is untouched.

In `src/components/thread-composer.tsx`:

```tsx
// 1) imports — add these; keep generateThread but drop scoreDraftBreakout from the import
import { generateThread } from "@/server/original";
import { precheckBreakout } from "@/server/predict";
import { BreakoutChip } from "@/components/predict/breakout-chip";
import type { ThreadDraft } from "@/lib/schemas";
import type { BreakoutPrecheck } from "@/lib/predict/schemas";

// 2) delete the ScoreBadge helper (lines 19–22) — replaced by <BreakoutChip>.

// 3) TweetCard: add profileId to props + repoint the check
function TweetCard({ tweet, type, idx, profileId }: { tweet: string; type: string; idx: number; profileId: string }) {
  const [body, setBody] = useState(tweet);
  const [precheck, setPrecheck] = useState<BreakoutPrecheck | null>(null);
  const [scoring, setScoring] = useState(false);

  async function checkBreakout() {
    setScoring(true);
    try {
      const r = await precheckBreakout(profileId, body);
      if (r.ok) setPrecheck(r.precheck); else toast.error(r.error);
    } finally {
      setScoring(false);
    }
  }
  // ...unchanged Card/Textarea/Copy markup...
  // replace the old `{score && (<ScoreBadge .../> ...)}` + `{score && score.fixes...}` blocks with:
  //   {precheck && <BreakoutChip precheck={precheck} />}
}

// 4) ThreadComposer render: pass profileId down (line 145)
<TweetCard idx={i} tweet={t.tweet} type={t.type} profileId={profileId} />
```

After the edit, `grep` confirms no remaining `scoreDraftBreakout`, `ScoreBadge`, or `/7` references in the file.

- [ ] **Step 3: Typecheck + suite**

Run: `npx tsc --noEmit && npm run test`
Expected: no TS errors; suite green.

- [ ] **Step 4: Commit**

```bash
git add src/components/predict/breakout-chip.tsx src/components/thread-composer.tsx
git commit -m "feat(predict): surface 0-100 breakout pre-check in draft composer"
```

**Acceptance:** "Breakout check" now shows a 0–100 chip + band colour + verdict + fixes; each check persists a `breakout` row; no leftover references to the raw 1–7 display.

---

### Task 12: Verification before completion + dogfood + merge to main

**REQUIRED SUB-SKILL:** Use superpowers:verification-before-completion before claiming done.

- [ ] **Step 1: Full suite green at target count**

Run: `npm run test`
Expected: all green, count ≥ ~615 (597 baseline + ~18 new predict tests). Record the exact number.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds, no type errors.

- [ ] **Step 3: Push the branch + deploy a Vercel preview**

```bash
git push -u origin feat/predict-module
```
Open the preview URL.

- [ ] **Step 4: Live-fire dogfood on @fcisco95 (prod data)**

On the deployed preview, signed in as the @fcisco95 profile:
- `/performance` → ForecastCard renders a real trajectory + weekly number from live `follower_snapshots`.
- Move each slider → dashed line + what-if number update.
- Run a breakout check on a real draft → 0–100 chip appears; confirm a `breakout` row landed (`select count(*) from predictions where type='breakout'` via Supabase MCP).
- Confirm `trajectory` + `weekly_forecast` rows exist for the profile.

- [ ] **Step 5: Merge to main (trunk, suite-green-gated, no PR)**

```bash
git checkout main
git merge --no-ff feat/predict-module -m "feat(predict): P4 predictions module"
git push origin main
```
Expected: prod auto-deploys; verify `/performance` on `https://embalio.vercel.app`.

- [ ] **Step 6: Refresh the handoff**

Update `docs/HANDOFF.md` (Session 14 — P4 shipped, new suite count, predictions table live) and drop a dated snapshot in `docs/handoffs/`.

**Acceptance:** suite ≥615 green, build clean, all five ACs verified live on prod against @fcisco95, receipts persisting, main deployed.

---

## Self-Review

**Spec coverage (§8 + the 5 ACs):**
- Trajectory curve → Tasks 4, 6, 9, 10 ✓
- What-if sliders → Tasks 7, 10 ✓
- Weekly forecast (EMA + linreg) → Tasks 4, 5, 9, 10 ✓
- Breakout 0–100 via existing prompt → Tasks 8, 9, 11 (reuses `scoreDraftBreakout`/`buildBreakoutPrompt`) ✓
- `predictions` table receipts → Tasks 2, 9 ✓
- New module `src/lib/predict/` parallel to kpis/topics ✓ · forecast card on /performance → Task 10 ✓
- Out of scope noted: expected-reach band, `/queue` route.

**Placeholder scan:** every code step contains full implementation; no TBD/TODO/"handle edge cases". Task 11 Step 2 (breakout wiring) is now pinned to the real call site (inner `TweetCard`, `thread-composer.tsx:24–78`) with `profileId` threaded down from `ThreadComposer` state — corrected after spec review found the original pointed at the wrong component.

**Type consistency:** `Trajectory`/`WeeklyForecast`/`WhatIfKnobs`/`BreakoutPrecheck`/`PredictionRecord` defined in Task 3, consumed unchanged in 5–11. `blendedDailyRate`/`avgDailyFollowsPerDay` (Task 4) consumed by forecast (5), trajectory (6), server (9). `dailyRate`, `r2`, `horizonDays`, `projected`/`history` names consistent across rate ↔ trajectory ↔ whatif ↔ chart. `breakoutScore0to100`/`summarizeBreakout`/`buildPredictionRecord` signatures match the naming contract and every call site. Server returns `ForecastBundle`/`BreakoutResult` result-unions consumed in Tasks 10/11.

**Spec-review verdict incorporated (2026-06-18):** BLOCKER (Task 11 mis-located wiring) → fixed. WARN (analytics_daily silently dropped) → now consumed as a tested sparse-data fallback rate (`avgDailyFollowsPerDay` → `blendedDailyRate`), basis documented in the Data-source decision. WARN/NIT (duplicated blend) → DRY'd into the shared `rate.ts`. Accepted NITs (left as-is): 1→0 maps to "0/100" (band label carries meaning); band derived from score thresholds rather than `hook_strength` (consistent 0–100 semantics).

**Test count estimate:** schemas 6 + regression 7 + rate 6 + forecast 4 + trajectory 2 + whatif 3 + breakout 4 + persist 2 = ~34 new test cases → suite ≈ 631 (clears the ≥615 gate).
