# P6 Strategy Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A living strategy module that shows the account's niche-cluster position, ranks 10–20 engagement targets with reasons + suggested approach, correlates replies→follows (n≥20, correlation-labeled), persists a weekly snapshot, pushes a review, and recommends target adds/drops a human approves — never auto-acting.

**Architecture:** New pure-logic module `src/lib/strategy/` (mirrors `src/lib/predict/`): zod schemas, per-file unit tests, pure functions that take DB rows and return typed objects. Side effects live in `src/server/strategy.ts` (result-union server actions that never throw) + a `/api/cron/strategy` weekly worker. Embeddings stay ephemeral (`embedTexts`, no pgvector). Targets reuse `recommendTargets`; the review push reuses `notify()`. One new `strategy_snapshots` table (service-role posture, RLS disabled = P7 item, mirrors `predictions`).

**Tech Stack:** Next.js 16 + React 19 + TypeScript, Zod, Vitest, Supabase (service-role + RLS-bound clients), OpenAI embeddings via `ai` SDK.

---

## Reuse map (audited — compose, do not rewrite)

| Need | Reuse | File |
|---|---|---|
| Module template (schemas/persist/pure-logic/test) | `predict/` | `src/lib/predict/{schemas,persist,forecast}.ts` |
| Result-union server action (never throws) | `getForecastBundle` / `importAnalyticsCsv` | `src/server/predict.ts`, `src/server/kpis.ts` |
| Cosine / embeddings (cluster centroids) | `relevanceFromVectors`, `embedText(s)` | `src/lib/embeddings.ts`, `src/lib/topics/board.ts:84-94` |
| 10–20 target picks **with reason + approach** | `recommendTargets` → `TargetQueue`/`EngagementTarget` | `src/server/target-queue.ts:12`, `src/lib/schemas.ts:160-171` |
| Per-pick "scan their recent posts" approach | `buildSeedScanPrompt(handles, date)` | `src/lib/voice-prompt.ts:304` |
| Review push (Telegram + web-push) | `notify(profileId, payload, deps)` | `src/lib/notify.ts:26`; deps assembled at `src/server/sniper.ts:182-204` |
| Reply signal | `activity_events.kind = 'reply_posted'` | `supabase/migrations/20260611_signal_warehouse.sql` |
| Follower deltas | `follower_snapshots` (profile_id, snapshot_date, followers) | same migration |
| Current target list (adds/drops) | `seed_targets` (handle, active) | `supabase/migrations/0001_init.sql` (+0006 unique) |
| Surfaced niche tweets (cluster + drop signal) | `candidates` (author_handle, tweet_text, status, scores) | `supabase/migrations/0001_init.sql` |
| New-table migration template + posture | `predictions` (RLS disabled, jsonb, profile_id FK) | `supabase/migrations/20260618_predictions.sql` |
| Cron secret guard + GH-Action | existing cron route + workflow | `src/app/api/cron/*/route.ts`, `.github/workflows/*` |

**DO NOT REDO:** embeddings/vector infra, `notify()` fan-out, `buildSeedScanPrompt`/`buildTargetFinderPrompt`, follower-snapshot capture, analytics windowing. Read & compose.

## Open decisions (confirm before execution — defaults chosen)

1. **Target-picks engine. RESOLVED (option 1, 2026-06-18):** reuse `recommendTargets` (`buildTargetFinderPrompt` → `EngagementTarget{handle,reason,priority,suggested_approach}`) for the 10–20 picks + adds/drops; ONE batched `buildSeedScanPrompt` scan enriches the top picks' `suggested_approach` with last-24h activity, **post-persist + best-effort** (Task 10). Both prompts composed, neither rewritten — satisfies acceptance #2.
2. **10–20 cap.** `TargetQueue.targets` is `.max(10)` and is used by onboarding. **Default:** new strategy-specific `StrategyTargets` schema (`.max(20)`) so onboarding is untouched. (Alternative: widen `TargetQueue` — risks onboarding.)
3. **UI surface.** **Default:** Strategy card on existing `/board` (already hosts `TargetBoardPanel` + `WatchTargetsCard`). (Alternative: dedicated `/strategy` route per the spec's sidebar map.)
4. **Snapshot storage.** **Default:** single `snapshot_json jsonb` column (mirrors `predictions.value_json`) rather than 4 columns. Idempotent weekly upsert on `(profile_id, week_of)`.

## File structure

```
src/lib/strategy/
  schemas.ts        schemas.test.ts     # zod contracts + types
  cluster.ts        cluster.test.ts     # centroid + niche position (pure)
  attribution.ts    attribution.test.ts # pearson + n-guard (pure)
  targets.ts        targets.test.ts     # shape recommended → 10–20 picks (pure)
  recommend.ts      recommend.test.ts   # adds/drops deltas (pure, never writes)
  snapshot.ts       snapshot.test.ts    # assemble snapshot + weekOfUTC (pure)
  persist.ts        persist.test.ts     # buildStrategySnapshotRecord (pure builder)
src/server/
  notify-deps.ts    notify-deps.test.ts # extracted buildNotifyDeps(sb)  [refactors sniper.ts]
  strategy.ts       strategy.test.ts    # result-union actions (never throw)
src/app/api/cron/strategy/route.ts      # weekly worker (CRON_SECRET-guarded)
src/components/strategy/
  strategy-board.tsx                     # client wrapper (profile dropdown + useTransition)
  strategy-card.tsx                      # card: cluster + picks + attribution + approve buttons
src/app/(app)/board/page.tsx             # mount <StrategyBoard/>  (modify)
supabase/migrations/20260618_strategy_snapshots.sql
src/lib/supabase/types.ts                # hand-reflect strategy_snapshots (modify)
.github/workflows/strategy-weekly.yml
```

**Dependency order:** 1 → (2,3,4 independent) → 5,6 → 7 → 8 → 9 → 10 → 11,12 → verification. Tasks 3/4 and 5/6 have no dependency on each other (parallelizable in the subagent loop).

**Conventions:** Every new public fn gets a unit test. Pure fns take `now: number` explicitly (no ambient `Date.now()` in tested paths — mirrors `predict/forecast.ts`). **Never mock crypto/uuid** (DB issues uuids via `gen_random_uuid()`; builders don't generate them). Commit after each task: `feat(strategy): <task>`.

---

### Task 1: Strategy schemas

**Files:**
- Create: `src/lib/strategy/schemas.ts`
- Test: `src/lib/strategy/schemas.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/strategy/schemas.test.ts
import { describe, it, expect } from "vitest";
import {
  ClusterPosition, StrategyTargets, ReplyFollowAttribution,
  RecommendationDeltas, StrategySnapshot, StrategySnapshotRecord,
} from "./schemas";

const target = { handle: "@paulg", reason: "high niche overlap", priority: "high" as const, suggested_approach: "reply to his startup threads" };

describe("strategy schemas", () => {
  it("accepts a valid cluster position and rejects out-of-range alignment", () => {
    expect(ClusterPosition.parse({ alignment: 0.7, band: "core", nicheSize: 12, spread: 0.3 }).band).toBe("core");
    expect(() => ClusterPosition.parse({ alignment: 1.4, band: "core", nicheSize: 1, spread: 0 })).toThrow();
  });

  it("caps strategy targets at 20", () => {
    const picks = Array.from({ length: 21 }, (_, i) => ({ ...target, handle: `@u${i}` }));
    expect(() => StrategyTargets.parse({ picks, generatedAt: "2026-06-18" })).toThrow();
  });

  it("attribution forces the correlation label and never carries a causal field", () => {
    const a = ReplyFollowAttribution.parse({ status: "correlation", n: 28, r: 0.4, label: "correlation", disclaimer: "x" });
    expect(a.status === "correlation" && a.label).toBe("correlation");
    expect(() => ReplyFollowAttribution.parse({ status: "correlation", n: 28, r: 0.4, label: "causation", disclaimer: "x" })).toThrow();
    const insuf = ReplyFollowAttribution.parse({ status: "insufficient_data", n: 5, minN: 20, message: "m" });
    expect(insuf.status).toBe("insufficient_data");
  });

  it("round-trips a full snapshot record", () => {
    const snap = StrategySnapshot.parse({
      weekOf: "2026-06-15",
      cluster: { alignment: 0.7, band: "core", nicheSize: 12, spread: 0.3 },
      targets: { picks: [target], generatedAt: "2026-06-18" },
      attribution: { status: "insufficient_data", n: 5, minN: 20, message: "m" },
      recommendations: { adds: [target], drops: [{ handle: "@dead", reason: "no activity" }] },
      generatedAt: "2026-06-18T00:00:00.000Z",
    });
    const rec = StrategySnapshotRecord.parse({ profile_id: "p1", week_of: snap.weekOf, snapshot_json: snap });
    expect(rec.week_of).toBe("2026-06-15");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/strategy/schemas.test.ts`
Expected: FAIL — `Cannot find module './schemas'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/strategy/schemas.ts
import { z } from "zod";
import { EngagementTarget } from "@/lib/schemas"; // { handle, reason, priority, suggested_approach }

export const ClusterPosition = z.object({
  alignment: z.number().min(0).max(1),          // cosine(account centroid, niche centroid), [0,1]
  band: z.enum(["core", "edge", "outside"]),    // where the account sits vs its niche
  nicheSize: z.number().int().nonnegative(),    // # of niche docs used
  spread: z.number().min(0),                    // mean intra-niche distance (context)
});
export type ClusterPosition = z.infer<typeof ClusterPosition>;

export const StrategyTargets = z.object({
  picks: z.array(EngagementTarget).min(0).max(20), // aim 10–20; min 0 tolerates cold-start (UI flags thin data)
  generatedAt: z.string(),
});
export type StrategyTargets = z.infer<typeof StrategyTargets>;

export const ReplyFollowAttribution = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("insufficient_data"),
    n: z.number().int().nonnegative(),
    minN: z.number().int().positive(),
    message: z.string(),
  }),
  z.object({
    status: z.literal("correlation"),
    n: z.number().int().positive(),
    r: z.number().min(-1).max(1),
    label: z.literal("correlation"),            // hard-coded — NEVER "causation"
    disclaimer: z.string(),
  }),
]);
export type ReplyFollowAttribution = z.infer<typeof ReplyFollowAttribution>;

export const RecommendedDrop = z.object({ handle: z.string(), reason: z.string() });
export const RecommendationDeltas = z.object({
  adds: z.array(EngagementTarget),
  drops: z.array(RecommendedDrop),
});
export type RecommendationDeltas = z.infer<typeof RecommendationDeltas>;

export const StrategySnapshot = z.object({
  weekOf: z.string(),                            // YYYY-MM-DD (UTC Monday)
  cluster: ClusterPosition,
  targets: StrategyTargets,
  attribution: ReplyFollowAttribution,
  recommendations: RecommendationDeltas,
  generatedAt: z.string(),
});
export type StrategySnapshot = z.infer<typeof StrategySnapshot>;

export const StrategySnapshotRecord = z.object({
  profile_id: z.string(),
  week_of: z.string(),
  snapshot_json: StrategySnapshot,
});
export type StrategySnapshotRecord = z.infer<typeof StrategySnapshotRecord>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/strategy/schemas.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/strategy/schemas.ts src/lib/strategy/schemas.test.ts
git commit -m "feat(strategy): zod schemas for cluster/targets/attribution/snapshot"
```

**Acceptance:** Every strategy output has a schema; alignment bounded [0,1]; picks capped at 20; attribution's `label` literal cannot be `"causation"`; full snapshot + persisted record round-trip.

---

### Task 2: `strategy_snapshots` migration + types

**Files:**
- Create: `supabase/migrations/20260618_strategy_snapshots.sql` (bump date prefix to the actual creation date if later; must sort after `20260618_predictions.sql`)
- Modify: `src/lib/supabase/types.ts` (hand-reflect, as P4/P5 did)

- [ ] **Step 1: Write the migration**

```sql
-- P6: weekly strategy snapshots — cluster position, target picks, reply→follow
-- attribution (correlation-labeled), and recommended adds/drops. snapshot_json
-- holds the full validated StrategySnapshot (schema in src/lib/strategy/schemas.ts).
-- Service-role only (RLS disabled, same posture as predictions + signal warehouse;
-- revisit in P7 hardening).
create table if not exists public.strategy_snapshots (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  week_of       date not null,
  snapshot_json jsonb not null,
  created_at    timestamptz not null default now()
);
create unique index if not exists strategy_snapshots_profile_week
  on public.strategy_snapshots (profile_id, week_of);
create index if not exists strategy_snapshots_profile_created
  on public.strategy_snapshots (profile_id, created_at desc);
alter table public.strategy_snapshots disable row level security;
```

- [ ] **Step 2: Apply to live Supabase**

Apply via the Supabase MCP `apply_migration` tool (project `vzxpakxjnuaesfxihyvl`), as P4/P5 did. (CLI equivalent if preferred: `supabase db push`.) Verify with `list_tables` that `strategy_snapshots` exists.

- [ ] **Step 3: Hand-reflect into `src/lib/supabase/types.ts`**

Add a `strategy_snapshots` entry to the `Tables` block mirroring the existing `predictions` entry: `Row`/`Insert`/`Update` with `id`, `profile_id`, `week_of: string`, `snapshot_json: Json`, `created_at: string` (Insert: `id?`, `created_at?`). Match the exact style of the `predictions` block above it.

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors referencing `strategy_snapshots`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260618_strategy_snapshots.sql src/lib/supabase/types.ts
git commit -m "feat(strategy): strategy_snapshots table (service-role, RLS-disabled) + types"
```

**Acceptance:** Table exists live with `(profile_id, week_of)` unique index, RLS disabled (matches `predictions`); `types.ts` reflects it; `tsc` clean. (Persist round-trip is verified by Task 8.)

---

### Task 3: Cluster position (centroid vs niche)

**Files:**
- Create: `src/lib/strategy/cluster.ts`
- Test: `src/lib/strategy/cluster.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/strategy/cluster.test.ts
import { describe, it, expect } from "vitest";
import { centroid, clusterPosition } from "./cluster";

describe("cluster", () => {
  it("mean-pools vectors into a centroid", () => {
    expect(centroid([[0, 0], [2, 2]])).toEqual([1, 1]);
    expect(centroid([])).toEqual([]);
  });

  it("classifies an aligned account as core and a divergent one as outside", () => {
    const niche = [[1, 0], [0.9, 0.1]];
    expect(clusterPosition({ accountVec: [1, 0], nicheVecs: niche }).band).toBe("core");
    expect(clusterPosition({ accountVec: [-1, 0], nicheVecs: niche }).band).toBe("outside");
  });

  it("returns zero alignment when an input is empty (no throw)", () => {
    expect(clusterPosition({ accountVec: [], nicheVecs: [] }).alignment).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/strategy/cluster.test.ts`
Expected: FAIL — `Cannot find module './cluster'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/strategy/cluster.ts
import { relevanceFromVectors } from "@/lib/embeddings"; // (cosine+1)/2 → [0,1]
import { ClusterPosition } from "./schemas";

/** Mean-pool equal-length embedding vectors into a centroid. */
export function centroid(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const acc = new Array<number>(dim).fill(0);
  for (const v of vectors) for (let i = 0; i < dim; i++) acc[i] += v[i];
  return acc.map((s) => s / vectors.length);
}

export interface ClusterPositionInput {
  accountVec: number[];
  nicheVecs: number[][];
  coreThreshold?: number; // default 0.66
  edgeThreshold?: number; // default 0.40
}

/** Where the account sits vs its niche centroid, plus the niche's spread. */
export function clusterPosition(input: ClusterPositionInput): ClusterPosition {
  const { accountVec, nicheVecs, coreThreshold = 0.66, edgeThreshold = 0.40 } = input;
  const c = centroid(nicheVecs);
  const alignment = c.length && accountVec.length ? relevanceFromVectors(accountVec, c) : 0;
  const band = alignment >= coreThreshold ? "core" : alignment >= edgeThreshold ? "edge" : "outside";
  const spread = nicheVecs.length
    ? nicheVecs.reduce((s, v) => s + (1 - relevanceFromVectors(v, c)), 0) / nicheVecs.length
    : 0;
  return ClusterPosition.parse({ alignment, band, nicheSize: nicheVecs.length, spread });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/strategy/cluster.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/strategy/cluster.ts src/lib/strategy/cluster.test.ts
git commit -m "feat(strategy): cluster centroid + niche position (reuses relevanceFromVectors)"
```

**Acceptance:** Pure, deterministic; reuses `relevanceFromVectors` (no new vector math); core/edge/outside banding; empty inputs → alignment 0, no throw. (Embedding *calls* happen in Task 10's server action.)

---

### Task 4: Reply→follow attribution (Pearson + n≥20 guard)

**Files:**
- Create: `src/lib/strategy/attribution.ts`
- Test: `src/lib/strategy/attribution.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/strategy/attribution.test.ts
import { describe, it, expect } from "vitest";
import { pearson, replyFollowAttribution, buildReplyFollowPairs, type DailyPair } from "./attribution";

const pairs = (n: number, fn: (i: number) => DailyPair): DailyPair[] => Array.from({ length: n }, (_, i) => fn(i));

describe("attribution", () => {
  it("computes pearson and is 0 for degenerate input", () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 5);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBe(0);
  });

  it("guards below n=20 with insufficient_data", () => {
    const a = replyFollowAttribution(pairs(19, (i) => ({ replies: i, followerDelta: i })));
    expect(a.status).toBe("insufficient_data");
    if (a.status === "insufficient_data") { expect(a.n).toBe(19); expect(a.minN).toBe(20); }
  });

  it("reports correlation (labeled, with disclaimer) at n≥20", () => {
    const a = replyFollowAttribution(pairs(22, (i) => ({ replies: i, followerDelta: 2 * i })));
    expect(a.status).toBe("correlation");
    if (a.status === "correlation") {
      expect(a.r).toBeCloseTo(1, 5);
      expect(a.label).toBe("correlation");
      expect(a.disclaimer.toLowerCase()).toContain("correlation");
      expect(a.disclaimer.toLowerCase()).not.toContain("causes");
    }
  });

  it("buildReplyFollowPairs dedups multi-source days (latest captured_at wins) then diffs", () => {
    const replies = [{ created_at: "2026-06-16T10:00:00Z" }, { created_at: "2026-06-16T12:00:00Z" }];
    const snaps = [
      { snapshot_date: "2026-06-15", captured_at: "2026-06-15T01:00:00Z", followers: 100 },
      { snapshot_date: "2026-06-16", captured_at: "2026-06-16T01:00:00Z", followers: 110 }, // csv
      { snapshot_date: "2026-06-16", captured_at: "2026-06-16T23:00:00Z", followers: 115 }, // later scrape wins
    ];
    expect(buildReplyFollowPairs(replies, snaps)).toEqual([{ replies: 2, followerDelta: 15 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/strategy/attribution.test.ts`
Expected: FAIL — `Cannot find module './attribution'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/strategy/attribution.ts
import { ReplyFollowAttribution } from "./schemas";

export interface DailyPair { replies: number; followerDelta: number; }

/** Pearson correlation of two series; 0 for degenerate (zero-variance) input. */
export function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n === 0) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { const a = xs[i] - mx, b = ys[i] - my; num += a * b; dx += a * a; dy += b * b; }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

const DISCLAIMER =
  "Correlation only — this is not proof that replies drive follows. Many factors move follower counts.";

/** Correlate daily reply counts with daily follower deltas. n-guard ≥ minN; never causal. */
export function replyFollowAttribution(pairs: DailyPair[], minN = 20): ReplyFollowAttribution {
  const n = pairs.length;
  if (n < minN) {
    return ReplyFollowAttribution.parse({
      status: "insufficient_data", n, minN,
      message: `Need ≥${minN} paired days; have ${n}. Keep replying — attribution unlocks at ${minN}.`,
    });
  }
  const r = pearson(pairs.map((p) => p.replies), pairs.map((p) => p.followerDelta));
  return ReplyFollowAttribution.parse({ status: "correlation", n, r, label: "correlation", disclaimer: DISCLAIMER });
}

export interface ReplyEventRow { created_at: string; }
export interface FollowerSnapRow { snapshot_date: string; captured_at: string; followers: number; }

/**
 * Build daily (replies, followerDelta) pairs for attribution. Collapses multi-source
 * follower rows to ONE per snapshot_date (latest captured_at wins) BEFORE diffing — the
 * follower_snapshots unique key is (profile_id, snapshot_date, source), so a csv + scrape
 * on the same day would otherwise inject a spurious zero-elapsed-day delta. Pure.
 */
export function buildReplyFollowPairs(replyEvents: ReplyEventRow[], snaps: FollowerSnapRow[]): DailyPair[] {
  const repliesByDay = new Map<string, number>();
  for (const e of replyEvents) {
    const day = e.created_at.slice(0, 10);
    repliesByDay.set(day, (repliesByDay.get(day) ?? 0) + 1);
  }
  const byDay = new Map<string, FollowerSnapRow>();
  for (const s of snaps) {
    const prev = byDay.get(s.snapshot_date);
    if (!prev || s.captured_at > prev.captured_at) byDay.set(s.snapshot_date, s);
  }
  const days = [...byDay.keys()].sort();
  const out: DailyPair[] = [];
  for (let i = 1; i < days.length; i++) {
    const cur = byDay.get(days[i])!;
    const prev = byDay.get(days[i - 1])!;
    out.push({ replies: repliesByDay.get(days[i]) ?? 0, followerDelta: cur.followers - prev.followers });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/strategy/attribution.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/strategy/attribution.ts src/lib/strategy/attribution.test.ts
git commit -m "feat(strategy): reply→follow Pearson attribution with n≥20 guard, correlation-labeled"
```

**Acceptance:** Pure; n<20 → `insufficient_data`; n≥20 → `correlation` with `label:"correlation"` + disclaimer; output schema makes a causal label unrepresentable. `buildReplyFollowPairs` collapses multi-source follower rows to one per day (latest `captured_at`) before diffing — fixes the `(profile_id, snapshot_date, source)` multi-row corruption. Task 10 fetches the rows and calls these pure fns.

---

### Task 5: Shape recommended targets → 10–20 picks

**Files:**
- Create: `src/lib/strategy/targets.ts`
- Test: `src/lib/strategy/targets.test.ts`

> Pure shaping only. The LLM call (`recommendTargets`) and `buildSeedScanPrompt` enrichment happen in Task 10. This function ranks/dedupes/clamps `EngagementTarget[]` into `StrategyTargets`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/strategy/targets.test.ts
import { describe, it, expect } from "vitest";
import { shapeStrategyTargets, mergeApproachScan } from "./targets";
import type { EngagementTarget } from "@/lib/schemas";

const t = (handle: string, priority: EngagementTarget["priority"]): EngagementTarget =>
  ({ handle, priority, reason: "r", suggested_approach: "a" });

describe("shapeStrategyTargets", () => {
  it("orders by priority, dedupes by handle (case-insensitive), and excludes given handles", () => {
    const out = shapeStrategyTargets(
      [t("@b", "low"), t("@a", "high"), t("@A", "high"), t("@c", "medium")],
      "2026-06-18",
      { excludeHandles: ["@c"] },
    );
    expect(out.picks.map((p) => p.handle)).toEqual(["@a", "@b"]);
    expect(out.generatedAt).toBe("2026-06-18");
  });

  it("clamps to max", () => {
    const many = Array.from({ length: 25 }, (_, i) => t(`@u${i}`, "medium"));
    expect(shapeStrategyTargets(many, "2026-06-18", { max: 20 }).picks).toHaveLength(20);
  });

  it("mergeApproachScan appends a recent-activity note only where a scan line exists", () => {
    const out = mergeApproachScan([t("@a", "high"), t("@b", "low")], { "@a": "shipped a new feature" });
    expect(out[0].suggested_approach).toContain("Recent: shipped a new feature");
    expect(out[1].suggested_approach).toBe("a"); // untouched
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/strategy/targets.test.ts`
Expected: FAIL — `Cannot find module './targets'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/strategy/targets.ts
import type { EngagementTarget } from "@/lib/schemas";
import { StrategyTargets } from "./schemas";

const PRIORITY_RANK: Record<EngagementTarget["priority"], number> = { high: 0, medium: 1, low: 2 };

/** Rank → dedupe (by lowercased handle) → exclude → clamp recommended targets into 10–20 picks. */
export function shapeStrategyTargets(
  recommended: EngagementTarget[],
  generatedAt: string,
  opts: { max?: number; excludeHandles?: string[] } = {},
): StrategyTargets {
  const { max = 20, excludeHandles = [] } = opts;
  const exclude = new Set(excludeHandles.map((h) => h.toLowerCase()));
  const seen = new Set<string>();
  const picks: EngagementTarget[] = [];
  for (const tgt of [...recommended].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])) {
    const key = tgt.handle.toLowerCase();
    if (seen.has(key) || exclude.has(key)) continue;
    seen.add(key);
    picks.push(tgt);
    if (picks.length >= max) break;
  }
  return StrategyTargets.parse({ picks, generatedAt });
}

/**
 * Fold a per-handle seed-scan note into each pick's suggested_approach (decision #1).
 * Pure: the server action runs the buildSeedScanPrompt scan and passes the parsed
 * handle→note map; picks without a note are returned unchanged.
 */
export function mergeApproachScan(
  picks: EngagementTarget[],
  scanByHandle: Record<string, string>,
): EngagementTarget[] {
  return picks.map((p) => {
    const note = scanByHandle[p.handle];
    return note ? { ...p, suggested_approach: `${p.suggested_approach} · Recent: ${note}` } : p;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/strategy/targets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/strategy/targets.ts src/lib/strategy/targets.test.ts
git commit -m "feat(strategy): shape recommended targets into 10–20 ranked picks"
```

**Acceptance:** Pure; priority-ordered; case-insensitive dedupe; excludes given handles; clamps to ≤20. `mergeApproachScan` folds a per-handle seed-scan note into `suggested_approach` (pure; only where a note exists). (Picks source = `recommendTargets`; thin data → fewer than 10, flagged in UI.)

---

### Task 6: Recommend adds/drops (never writes)

**Files:**
- Create: `src/lib/strategy/recommend.ts`
- Test: `src/lib/strategy/recommend.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/strategy/recommend.test.ts
import { describe, it, expect } from "vitest";
import { recommendAddsDrops } from "./recommend";
import type { EngagementTarget } from "@/lib/schemas";

const pick = (handle: string): EngagementTarget => ({ handle, priority: "high", reason: "r", suggested_approach: "a" });

describe("recommendAddsDrops", () => {
  it("adds picks not already followed; drops active seeds with zero activity", () => {
    const out = recommendAddsDrops({
      picks: [pick("@new"), pick("@existing")],
      activeSeedHandles: ["@existing", "@dead"],
      activityByHandle: { "@existing": 4, "@dead": 0 },
    });
    expect(out.adds.map((a) => a.handle)).toEqual(["@new"]);
    expect(out.drops.map((d) => d.handle)).toEqual(["@dead"]);
  });

  it("caps drops", () => {
    const out = recommendAddsDrops({
      picks: [], activeSeedHandles: ["@a", "@b", "@c"], activityByHandle: {}, maxDrops: 2,
    });
    expect(out.drops).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/strategy/recommend.test.ts`
Expected: FAIL — `Cannot find module './recommend'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/strategy/recommend.ts
import type { EngagementTarget } from "@/lib/schemas";
import { RecommendationDeltas } from "./schemas";

export interface RecommendInput {
  picks: EngagementTarget[];                  // shaped fresh targets
  activeSeedHandles: string[];                // current active seed_targets
  activityByHandle: Record<string, number>;  // candidates surfaced per seed handle in the window
  maxDrops?: number;                          // default 5
}

/** Pure recommendation. NEVER mutates — Task 10's applyTargetRecommendation does the write, on human approval. */
export function recommendAddsDrops(input: RecommendInput): RecommendationDeltas {
  const { picks, activeSeedHandles, activityByHandle, maxDrops = 5 } = input;
  const active = new Set(activeSeedHandles.map((h) => h.toLowerCase()));
  const adds = picks.filter((p) => !active.has(p.handle.toLowerCase()));
  const drops = activeSeedHandles
    .filter((h) => (activityByHandle[h] ?? activityByHandle[h.toLowerCase()] ?? 0) === 0)
    .slice(0, maxDrops)
    .map((handle) => ({ handle, reason: "No fresh opportunities surfaced from this handle in the window." }));
  return RecommendationDeltas.parse({ adds, drops });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/strategy/recommend.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/strategy/recommend.ts src/lib/strategy/recommend.test.ts
git commit -m "feat(strategy): adds/drops recommendation deltas (pure, never mutates)"
```

**Acceptance:** Pure, no DB; adds = picks not already active; drops = active seeds with zero window activity, capped; performs no writes.

---

### Task 7: Snapshot assembly + week anchor

**Files:**
- Create: `src/lib/strategy/snapshot.ts`
- Test: `src/lib/strategy/snapshot.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/strategy/snapshot.test.ts
import { describe, it, expect } from "vitest";
import { weekOfUTC, buildStrategySnapshot } from "./snapshot";

describe("snapshot", () => {
  it("weekOfUTC returns the Monday (UTC) of the given instant", () => {
    // 2026-06-18 is a Thursday → Monday is 2026-06-15
    expect(weekOfUTC(Date.parse("2026-06-18T12:00:00Z"))).toBe("2026-06-15");
    expect(weekOfUTC(Date.parse("2026-06-15T00:00:00Z"))).toBe("2026-06-15");
  });

  it("assembles a schema-valid snapshot", () => {
    const snap = buildStrategySnapshot({
      weekOf: "2026-06-15",
      cluster: { alignment: 0.7, band: "core", nicheSize: 10, spread: 0.2 },
      targets: { picks: [], generatedAt: "2026-06-18" },
      attribution: { status: "insufficient_data", n: 0, minN: 20, message: "m" },
      recommendations: { adds: [], drops: [] },
      generatedAt: "2026-06-18T00:00:00.000Z",
    });
    expect(snap.weekOf).toBe("2026-06-15");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/strategy/snapshot.test.ts`
Expected: FAIL — `Cannot find module './snapshot'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/strategy/snapshot.ts
import { StrategySnapshot } from "./schemas";
import type { ClusterPosition, StrategyTargets, ReplyFollowAttribution, RecommendationDeltas } from "./schemas";

/** YYYY-MM-DD of the UTC Monday of the week containing `now` (ms). */
export function weekOfUTC(now: number): string {
  const d = new Date(now);
  const day = d.getUTCDay();               // 0=Sun..6=Sat
  const diff = (day + 6) % 7;              // days since Monday
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff));
  return monday.toISOString().slice(0, 10);
}

export interface SnapshotParts {
  weekOf: string;
  cluster: ClusterPosition;
  targets: StrategyTargets;
  attribution: ReplyFollowAttribution;
  recommendations: RecommendationDeltas;
  generatedAt: string;
}

export function buildStrategySnapshot(parts: SnapshotParts): StrategySnapshot {
  return StrategySnapshot.parse(parts);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/strategy/snapshot.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/strategy/snapshot.ts src/lib/strategy/snapshot.test.ts
git commit -m "feat(strategy): snapshot assembly + UTC week anchor"
```

**Acceptance:** `weekOfUTC` returns the UTC Monday; `buildStrategySnapshot` returns a schema-valid `StrategySnapshot`; pure (`now` passed explicitly).

---

### Task 8: Persist builder

**Files:**
- Create: `src/lib/strategy/persist.ts`
- Test: `src/lib/strategy/persist.test.ts`

> Mirrors `src/lib/predict/persist.ts:buildPredictionRecord` — pure builder, no DB calls; the caller (Task 10) does the upsert.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/strategy/persist.test.ts
import { describe, it, expect } from "vitest";
import { buildStrategySnapshotRecord } from "./persist";
import type { StrategySnapshot } from "./schemas";

const snap: StrategySnapshot = {
  weekOf: "2026-06-15",
  cluster: { alignment: 0.5, band: "edge", nicheSize: 8, spread: 0.3 },
  targets: { picks: [], generatedAt: "2026-06-18" },
  attribution: { status: "insufficient_data", n: 0, minN: 20, message: "m" },
  recommendations: { adds: [], drops: [] },
  generatedAt: "2026-06-18T00:00:00.000Z",
};

describe("buildStrategySnapshotRecord", () => {
  it("builds a record keyed by profile + week", () => {
    const rec = buildStrategySnapshotRecord(snap, "profile-1");
    expect(rec).toEqual({ profile_id: "profile-1", week_of: "2026-06-15", snapshot_json: snap });
  });

  it("throws on an invalid snapshot", () => {
    expect(() => buildStrategySnapshotRecord({ ...snap, weekOf: 123 as unknown as string }, "p1")).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/strategy/persist.test.ts`
Expected: FAIL — `Cannot find module './persist'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/strategy/persist.ts
import { StrategySnapshotRecord } from "./schemas";
import type { StrategySnapshot } from "./schemas";

/** Pure builder for a strategy_snapshots row. Caller upserts on (profile_id, week_of). */
export function buildStrategySnapshotRecord(snapshot: StrategySnapshot, profileId: string): StrategySnapshotRecord {
  return StrategySnapshotRecord.parse({
    profile_id: profileId,
    week_of: snapshot.weekOf,
    snapshot_json: snapshot,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/strategy/persist.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/strategy/persist.ts src/lib/strategy/persist.test.ts
git commit -m "feat(strategy): pure strategy_snapshots record builder"
```

**Acceptance:** Pure builder; validates via schema; throws on bad input; no DB import (mirrors predict).

---

### Task 9: Extract `buildNotifyDeps(sb)` + refactor sniper

**Files:**
- Create: `src/server/notify-deps.ts`, `src/server/notify-deps.test.ts`
- Modify: `src/server/sniper.ts:182-204` (use the shared factory)

> DRY: `notify()` deps are currently inlined in `sniper.ts`. Extract so the strategy cron (Task 11) reuses them. Sniper's existing tests must stay green.

- [ ] **Step 1: Write the failing test**

```ts
// src/server/notify-deps.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { buildNotifyDeps } from "./notify-deps";

function fakeSb() {
  return { from: () => ({ select: () => ({ eq: async () => ({ data: [] }) }), delete: () => ({ eq: async () => ({}) }) }) } as never;
}

describe("buildNotifyDeps", () => {
  beforeEach(() => { delete process.env.TELEGRAM_BOT_TOKEN; delete process.env.TELEGRAM_CHAT_ID; });

  it("omits sendTelegram when env is not configured", () => {
    expect(buildNotifyDeps(fakeSb()).sendTelegram).toBeUndefined();
  });

  it("wires sendTelegram when env is configured", () => {
    process.env.TELEGRAM_BOT_TOKEN = "t"; process.env.TELEGRAM_CHAT_ID = "c";
    expect(typeof buildNotifyDeps(fakeSb()).sendTelegram).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/notify-deps.test.ts`
Expected: FAIL — `Cannot find module './notify-deps'`.

- [ ] **Step 3: Write the factory, then refactor sniper to use it**

```ts
// src/server/notify-deps.ts
import { sendTelegram } from "@/lib/telegram";
import { sendWebPush } from "@/lib/push";
import type { NotifyDeps } from "@/lib/notify";

/** Real Telegram + web-push deps for notify(). Telegram gated on env. `sb` is a supabaseService()/supabaseServer() client. */
export function buildNotifyDeps(sb: { from: (t: string) => any }): NotifyDeps {
  const telegramConfigured = !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
  return {
    sendTelegram: telegramConfigured ? (text) => sendTelegram(text) : undefined,
    loadPushSubs: async (pid) => {
      const { data } = await sb.from("push_subscriptions").select("endpoint, p256dh, auth").eq("profile_id", pid);
      return data ?? [];
    },
    sendPush: (sub, payload) => sendWebPush(sub, payload),
    prunePushSub: async (endpoint) => { await sb.from("push_subscriptions").delete().eq("endpoint", endpoint); },
  };
}
```

Then in `src/server/sniper.ts`: import `buildNotifyDeps`, replace the inline deps object (lines ~191-204) with `buildNotifyDeps(sb)`. Keep the `notify(profileId, { title, body, url, telegramText }, buildNotifyDeps(sb))` call shape. Remove now-unused `sendTelegram`/`sendWebPush` imports from sniper **only if** no longer referenced.

> Note: type `sb` to match `supabaseService()`'s return if the loose `{ from }` type causes friction; prefer `SupabaseClient<Database>` if it compiles cleanly against both call sites.

- [ ] **Step 4: Run tests to verify factory + sniper both pass**

Run: `npx vitest run src/server/notify-deps.test.ts src/server/sniper.test.ts`
Expected: PASS (new factory tests + existing sniper suite still green).

- [ ] **Step 5: Commit**

```bash
git add src/server/notify-deps.ts src/server/notify-deps.test.ts src/server/sniper.ts
git commit -m "refactor(notify): extract buildNotifyDeps(sb); sniper reuses it"
```

**Acceptance:** `buildNotifyDeps` gates Telegram on env, wires push read/prune; sniper refactored to use it; sniper suite stays green.

---

### Task 10: Server actions (`getStrategyBoard`, `runWeeklyStrategy`, `applyTargetRecommendation`)

**Files:**
- Create: `src/server/strategy.ts`, `src/server/strategy.test.ts`

> Result-unions that **never throw** (mirror `src/server/predict.ts`). This is the only layer that touches the DB / LLM / push. `applyTargetRecommendation` is the human-in-the-loop write — it acts **only** on explicit handles from a button click.

- [ ] **Step 1: Write the failing test** (error-path + human-in-loop guard; pure orchestration via the lib fns is already covered by Tasks 3–8)

```ts
// src/server/strategy.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => { throw new Error("db down"); },
  supabaseService: () => { throw new Error("db down"); },
}));

import { getStrategyBoard, applyTargetRecommendation } from "./strategy";

describe("strategy server actions", () => {
  it("getStrategyBoard returns an error discriminant instead of throwing", async () => {
    const r = await getStrategyBoard("p1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("db down");
  });

  it("applyTargetRecommendation refuses an empty decision (human-in-the-loop, no auto-act)", async () => {
    const r = await applyTargetRecommendation("p1", { adds: [], drops: [] });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/strategy.test.ts`
Expected: FAIL — `Cannot find module './strategy'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/server/strategy.ts
"use server";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";
import { embedTexts } from "@/lib/embeddings";
import { clusterPosition } from "@/lib/strategy/cluster";
import { replyFollowAttribution, buildReplyFollowPairs } from "@/lib/strategy/attribution";
import { shapeStrategyTargets, mergeApproachScan } from "@/lib/strategy/targets";
import { recommendAddsDrops } from "@/lib/strategy/recommend";
import { buildStrategySnapshot, weekOfUTC } from "@/lib/strategy/snapshot";
import { buildStrategySnapshotRecord } from "@/lib/strategy/persist";
import { recommendTargets } from "@/server/target-queue";
import { buildSeedScanPrompt } from "@/lib/voice-prompt";
import { generateText } from "@/lib/generate";
import { notify } from "@/lib/notify";
import { buildNotifyDeps } from "@/server/notify-deps";
import { revalidatePath } from "next/cache";
import type { EngagementTarget } from "@/lib/schemas";
import type { StrategySnapshot, StrategyTargets } from "@/lib/strategy/schemas";
import type { Json } from "@/lib/supabase/types";

export type StrategyBoardResult = { ok: true; snapshot: StrategySnapshot | null } | { ok: false; error: string };

export async function getStrategyBoard(profileId: string): Promise<StrategyBoardResult> {
  try {
    const sb = await supabaseServer();
    const { data } = await sb
      .from("strategy_snapshots").select("snapshot_json")
      .eq("profile_id", profileId).order("week_of", { ascending: false }).limit(1).maybeSingle();
    return { ok: true, snapshot: (data?.snapshot_json as StrategySnapshot) ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "failed to load strategy" };
  }
}

export type RunStrategyResult = { ok: true; weekOf: string; pushed: boolean } | { ok: false; error: string };

export async function runWeeklyStrategy(profileId: string, now = Date.now()): Promise<RunStrategyResult> {
  try {
    const sb = supabaseService();
    const weekOf = weekOfUTC(now);

    // profile (niche/pillars/north-star)
    const { data: profile } = await sb.from("profiles")
      .select("handle, niche_description, content_pillars, north_star_metric").eq("id", profileId).single();
    if (!profile) return { ok: false, error: "profile not found" };

    // active seeds
    const { data: seedRows } = await sb.from("seed_targets")
      .select("handle").eq("profile_id", profileId).eq("active", true);
    const activeSeedHandles = (seedRows ?? []).map((r) => r.handle).filter(Boolean) as string[];

    // niche material = recently surfaced candidate tweets + per-handle activity (drop signal)
    const { data: cands } = await sb.from("candidates")
      .select("author_handle, tweet_text").eq("profile_id", profileId)
      .order("pulled_at", { ascending: false }).limit(60);
    const nicheTexts = (cands ?? []).map((c) => c.tweet_text).filter(Boolean);
    const activityByHandle: Record<string, number> = {};
    for (const c of cands ?? []) activityByHandle[c.author_handle] = (activityByHandle[c.author_handle] ?? 0) + 1;

    // CLUSTER — embed account text + niche texts on demand (ephemeral)
    const accountText = `${profile.niche_description ?? ""} ${((profile.content_pillars as string[]) ?? []).join(" ")}`.trim();
    let cluster = clusterPosition({ accountVec: [], nicheVecs: [] });
    if (accountText && nicheTexts.length) {
      const vectors = await embedTexts([accountText, ...nicheTexts]);
      cluster = clusterPosition({ accountVec: vectors[0], nicheVecs: vectors.slice(1) });
    }

    // TARGETS — reuse recommendTargets; degrade to [] if the research call throws so cluster +
    // attribution + snapshot still persist (don't let a flaky LLM call discard the whole week).
    let recommended: EngagementTarget[] = [];
    try {
      const queue = await recommendTargets({
        existingHandles: activeSeedHandles,
        contentPillars: (profile.content_pillars as string[]) ?? [],
        northStarMetric: profile.north_star_metric ?? null,
      });
      recommended = queue.targets;
    } catch (e) {
      console.error("[strategy] recommendTargets failed; degrading to empty picks:", String(e).slice(0, 200));
    }
    const targets = shapeStrategyTargets(recommended, new Date(now).toISOString());
    // Approach enrichment via buildSeedScanPrompt runs post-persist (best-effort) — see below.

    // ATTRIBUTION — fetch rows; the pure pair-builder dedups multi-source days before diffing
    const { data: replyEvents } = await sb.from("activity_events")
      .select("created_at").eq("profile_id", profileId).eq("kind", "reply_posted");
    const { data: snaps } = await sb.from("follower_snapshots")
      .select("snapshot_date, captured_at, followers").eq("profile_id", profileId);
    const attribution = replyFollowAttribution(buildReplyFollowPairs(replyEvents ?? [], snaps ?? []));

    // RECOMMEND adds/drops (pure; human approves later)
    const recommendations = recommendAddsDrops({ picks: targets.picks, activeSeedHandles, activityByHandle });

    // SNAPSHOT + PERSIST base FIRST (idempotent upsert) — so a slow/failed seed-scan enrich
    // can never cost us the week's snapshot.
    const persist = async (t: StrategyTargets) => {
      const snapshot = buildStrategySnapshot({
        weekOf, cluster, targets: t, attribution, recommendations, generatedAt: new Date(now).toISOString(),
      });
      const rec = buildStrategySnapshotRecord(snapshot, profileId);
      await sb.from("strategy_snapshots").upsert(
        { profile_id: rec.profile_id, week_of: rec.week_of, snapshot_json: rec.snapshot_json as unknown as Json },
        { onConflict: "profile_id,week_of" },
      );
    };
    await persist(targets);

    // REVIEW PUSH via existing notify()
    const result = await notify(
      profileId,
      {
        title: "📊 Weekly strategy review",
        body: `${cluster.band} of niche · ${targets.picks.length} target picks · ${recommendations.adds.length} adds / ${recommendations.drops.length} drops`,
        url: "/board",
      },
      buildNotifyDeps(sb),
    );

    // APPROACH ENRICH (decision #1) — ONE batched buildSeedScanPrompt scan over the top picks'
    // handles → fold each handle's last-24h activity into suggested_approach → re-upsert.
    // Best-effort: the base snapshot already shipped, so a scan failure/timeout is non-fatal.
    try {
      if (targets.picks.length) {
        const handles = targets.picks.slice(0, 10).map((p) => p.handle);
        const dateStr = new Date(now).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
        const scan = await generateText(buildSeedScanPrompt(handles, dateStr), { research: true });
        const scanByHandle: Record<string, string> = {};
        for (const p of targets.picks) {
          const needle = p.handle.toLowerCase().replace(/^@/, "");
          const line = scan.split("\n").find((l) => l.toLowerCase().includes(needle));
          if (line) scanByHandle[p.handle] = line.trim().slice(0, 160);
        }
        if (Object.keys(scanByHandle).length) {
          await persist({ ...targets, picks: mergeApproachScan(targets.picks, scanByHandle) });
        }
      }
    } catch (e) {
      console.error("[strategy] seed-scan enrich skipped:", String(e).slice(0, 200));
    }

    return { ok: true, weekOf, pushed: result.telegram === "sent" || result.push.sent > 0 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "weekly strategy failed" };
  }
}

export type ApplyResult = { ok: true; added: number; dropped: number } | { ok: false; error: string };

/** HUMAN-IN-THE-LOOP: mutates seed_targets ONLY for the explicit handles the user approved. Never auto-called. */
export async function applyTargetRecommendation(
  profileId: string,
  decision: { adds: string[]; drops: string[] },
): Promise<ApplyResult> {
  try {
    if (!decision.adds.length && !decision.drops.length) return { ok: false, error: "nothing to apply" };
    const sb = await supabaseServer();
    if (decision.adds.length) {
      await sb.from("seed_targets").upsert(
        decision.adds.map((handle) => ({ profile_id: profileId, handle, active: true })),
        { onConflict: "profile_id,handle" },
      );
    }
    if (decision.drops.length) {
      await sb.from("seed_targets").update({ active: false })
        .eq("profile_id", profileId).in("handle", decision.drops);
    }
    revalidatePath("/board");
    return { ok: true, added: decision.adds.length, dropped: decision.drops.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "apply failed" };
  }
}```

> Verified against the codebase: account vector uses `profiles.niche_description` (the real column — there is no `niche`) + `content_pillars`. `seed_targets` `onConflict:"profile_id,handle"` matches the 0006 unique index. `recommendTargets` runs the `{research:true}` path (Claude CLI locally / Gemini in prod) — wrapped in a local try so a failure degrades picks to `[]` without losing the snapshot. Attribution row-fetch → `buildReplyFollowPairs` (Task 4, pure + tested).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/strategy.test.ts`
Expected: PASS (error discriminant on DB failure; empty decision refused).

- [ ] **Step 5: Commit**

```bash
git add src/server/strategy.ts src/server/strategy.test.ts
git commit -m "feat(strategy): result-union server actions (board, weekly run, human-approved apply)"
```

**Acceptance:** All three actions return discriminated unions and never throw; `runWeeklyStrategy` composes the pure lib fns, persists the base snapshot (idempotent upsert), pushes via `notify()`, then runs ONE best-effort `buildSeedScanPrompt` scan (`generateText`, research) → `mergeApproachScan` → re-upsert (criterion #2 satisfied; scan failure non-fatal since base already shipped); cluster + attribution + snapshot persist even if `recommendTargets` throws (picks degrade to `[]`); attribution uses the pure dedup-correct `buildReplyFollowPairs`; reads `profiles.niche_description`; `applyTargetRecommendation` writes **only** the explicit approved handles (refuses empty) — no auto-acting.

---

### Task 11: Weekly cron worker + GH-Action

**Files:**
- Create: `src/app/api/cron/strategy/route.ts`, `.github/workflows/strategy-weekly.yml`
- Test: `src/app/api/cron/strategy/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/cron/strategy/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/strategy", () => ({ runWeeklyStrategy: vi.fn(async () => ({ ok: true, weekOf: "2026-06-15", pushed: true })) }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseService: () => ({ from: () => ({ select: () => ({ eq: async () => ({ data: [{ profile_id: "p1" }] }) }) }) }),
}));

import { GET } from "./route";
import { runWeeklyStrategy } from "@/server/strategy";

describe("GET /api/cron/strategy", () => {
  beforeEach(() => { process.env.CRON_SECRET = "secret"; vi.clearAllMocks(); });

  it("401s without the secret and never runs the worker", async () => {
    const res = await GET(new Request("https://x/api/cron/strategy"));
    expect(res.status).toBe(401);
    expect(runWeeklyStrategy).not.toHaveBeenCalled();
  });

  it("runs runWeeklyStrategy for each active profile with the secret", async () => {
    const res = await GET(new Request("https://x/api/cron/strategy", { headers: { authorization: "Bearer secret" } }));
    expect(res.status).toBe(200);
    expect(runWeeklyStrategy).toHaveBeenCalledWith("p1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/cron/strategy/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Write implementation** (mirror the secret guard of the existing cron route — open `src/app/api/cron/*/route.ts` and copy its exact auth check)

```ts
// src/app/api/cron/strategy/route.ts
import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { runWeeklyStrategy } from "@/server/strategy";
import { cronAuthError } from "@/lib/cron-auth"; // constant-time Bearer guard; 500 if CRON_SECRET unset

export const maxDuration = 300; // recommendTargets is a multi-minute research call (runner caps at 2×120s)

export async function GET(req: Request) {
  const authError = cronAuthError(req);
  if (authError) return authError;
  const sb = supabaseService();
  const { data } = await sb.from("seed_targets").select("profile_id").eq("active", true);
  const profileIds = [...new Set((data ?? []).map((r) => r.profile_id))];
  const results: Array<{ id: string; ok: boolean }> = [];
  let failed = 0;
  for (const id of profileIds) {
    const r = await runWeeklyStrategy(id);
    results.push({ id, ok: r.ok });
    if (!r.ok) failed++;
  }
  // Total outage → 500 so the cron is visibly failing (mirrors targeting route).
  const allFailed = profileIds.length > 0 && failed === profileIds.length;
  return NextResponse.json({ profiles: profileIds.length, results }, { status: allFailed ? 500 : 200 });
}
```

> **Budget note:** with the live dogfood = a single profile (@fcisco95), one `runWeeklyStrategy` (≤240s research + embeds) fits under `maxDuration = 300`. For >1 active profile the **sequential** research loop is structurally over-budget — defer multi-profile to a per-profile dispatch (follow-up, not P6 dogfood scope). Also confirm `recommendTargets`' `{research:true}` path behaves under prod `GEN_BACKEND=gemini` during dogfood.

```yaml
# .github/workflows/strategy-weekly.yml  (mirror the existing refresh/sniper workflow's auth header style)
name: strategy-weekly
on:
  schedule:
    - cron: "0 13 * * 1"   # Mondays 13:00 UTC
  workflow_dispatch:
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger weekly strategy
        run: |
          curl -fsS -X GET "$APP_BASE_URL/api/cron/strategy" \
            -H "authorization: Bearer ${{ secrets.CRON_SECRET }}"
        env:
          APP_BASE_URL: ${{ vars.APP_BASE_URL }}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/cron/strategy/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/strategy/route.ts src/app/api/cron/strategy/route.test.ts .github/workflows/strategy-weekly.yml
git commit -m "feat(strategy): weekly cron worker + GH-Action (CRON_SECRET-guarded)"
```

**Acceptance:** Route uses the shared `cronAuthError` helper (constant-time compare; 401 on bad/absent Bearer, 500 if `CRON_SECRET` unset — never runs the worker unauthorized); with the secret, invokes `runWeeklyStrategy` per active profile (asserted) and 500s on total outage; `maxDuration = 300`; workflow fires weekly + on dispatch. Persist + push happen inside `runWeeklyStrategy` (Task 10).

---

### Task 12: Strategy card on `/board`

**Files:**
- Create: `src/components/strategy/strategy-board.tsx`, `src/components/strategy/strategy-card.tsx`, `src/components/strategy/strategy-card.test.tsx`
- Modify: `src/app/(app)/board/page.tsx` (mount `<StrategyBoard/>`)

> Mirror `src/components/topics/{topic-board,topic-card}.tsx` (profile dropdown + `useTransition` + server-action call).

- [ ] **Step 1: Write the failing test** (render correctness — attribution label + human-in-loop buttons)

```tsx
// src/components/strategy/strategy-card.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StrategyCard } from "./strategy-card";
import type { StrategySnapshot } from "@/lib/strategy/schemas";

vi.mock("@/server/strategy", () => ({ applyTargetRecommendation: vi.fn(async () => ({ ok: true, added: 1, dropped: 0 })) }));

const snap: StrategySnapshot = {
  weekOf: "2026-06-15",
  cluster: { alignment: 0.72, band: "core", nicheSize: 12, spread: 0.2 },
  targets: { picks: [{ handle: "@paulg", priority: "high", reason: "overlap", suggested_approach: "reply to threads" }], generatedAt: "2026-06-18" },
  attribution: { status: "correlation", n: 28, r: 0.41, label: "correlation", disclaimer: "Correlation only — not proof replies drive follows." },
  recommendations: { adds: [{ handle: "@new", priority: "high", reason: "rising", suggested_approach: "quote-tweet" }], drops: [{ handle: "@dead", reason: "no activity" }] },
  generatedAt: "2026-06-18T00:00:00.000Z",
};

describe("StrategyCard", () => {
  it("labels attribution as correlation, never causation", () => {
    render(<StrategyCard snapshot={snap} profileId="p1" />);
    expect(screen.getByText(/correlation/i)).toBeInTheDocument();
    expect(screen.queryByText(/caus(e|ation)/i)).toBeNull();
  });

  it("shows approve controls for adds/drops (human-in-the-loop)", () => {
    render(<StrategyCard snapshot={snap} profileId="p1" />);
    expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/strategy/strategy-card.test.tsx`
Expected: FAIL — `Cannot find module './strategy-card'`.

- [ ] **Step 3: Implement** `strategy-card.tsx` (display cluster band + `alignment` %, the picks with `reason`/`suggested_approach`, the attribution block — `insufficient_data` → "n/minN, keep going"; `correlation` → `r` + **prominent disclaimer**; adds/drops each with an Approve button calling `applyTargetRecommendation(profileId, { adds:[h], drops:[] })` / `{ adds:[], drops:[h] }` inside `useTransition`), and `strategy-board.tsx` (mirror `topic-board.tsx`: profile dropdown → `getStrategyBoard(profileId)` → render card or empty state). Mount `<StrategyBoard profiles={profiles} />` in `board/page.tsx` next to the existing panels.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/strategy/strategy-card.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/strategy/ src/app/(app)/board/page.tsx
git commit -m "feat(strategy): strategy card on /board (cluster, picks, correlation-labeled attribution, approve adds/drops)"
```

**Acceptance:** Card renders cluster position, 10–20 picks (reason + approach), attribution **explicitly correlation-labeled** with disclaimer (no causal language), and adds/drops gated behind Approve buttons (no auto-act). Mounted on `/board`.

---

## Verification & dogfood (EXIT GATE — required before merge)

Per **superpowers:verification-before-completion** — run, capture output, claim nothing unverified.

- [ ] **Full suite green:** `npm run test` → expect ~657 passing (631 baseline + ~26 new across the strategy tasks); floor ≥645, 0 failing. Paste the summary line.
- [ ] **Build clean:** `npm run build` → no type errors. (Stop `npm run dev` first — `.next` clash zombies the dev port; known gotcha.)
- [ ] **Live-fire dogfood on @fcisco95 (Vercel prod):** after deploy, trigger `GET /api/cron/strategy` with `Bearer $CRON_SECRET` (or `workflow_dispatch`). Confirm: (a) a `strategy_snapshots` row written for the profile/week; (b) review push received (Telegram and/or web-push); (c) `/board` renders the Strategy card with real cluster/picks/attribution; (d) approving one add flips `seed_targets.active`. Record evidence in the handoff.
- [ ] **Merge:** trunk is direct-to-main, suite-green-gated. Merge `feat/strategy-engine` → `main` (`--no-ff`), push (auto-deploys).

**Reminder (not P6 scope):** RLS stays disabled on service-role tables incl. the new `strategy_snapshots` — that is the **P7** hardening gate before any beta invite. Do not open beta before P7.

---

## Self-review (writing-plans checklist — completed)

- **Spec coverage:** cluster position → T3/T10; 10–20 picks w/ reason+approach → T1/T5/T10 (reuse `recommendTargets` + compose `buildSeedScanPrompt`); reply→follow attribution n≥20 correlation-labeled → T1/T4/T10; weekly snapshot + review push → T2/T7/T8/T10/T11; human approves adds/drops, never auto-acts → T6/T10/T12; new `src/lib/strategy/` module → T1–T8; `strategy_snapshots` table → T2; UI card → T12. All covered.
- **Placeholder scan:** every code step shows runnable code; the two "mirror existing X" notes (cron secret guard, board card markup) cite exact reference files + show the new code. No TBD/TODO.
- **Type consistency:** `ClusterPosition`, `StrategyTargets`, `ReplyFollowAttribution`, `RecommendationDeltas`, `StrategySnapshot`, `StrategySnapshotRecord`, `DailyPair`, `buildReplyFollowPairs`, `ReplyEventRow`, `FollowerSnapRow`, `buildStrategySnapshotRecord`, `weekOfUTC`, `clusterPosition`, `shapeStrategyTargets`, `recommendAddsDrops`, `buildNotifyDeps` — names used identically across tasks.

---

## Independent spec-review — verdict & fixes applied (2026-06-18)

Verdict: **APPROVE-WITH-FIXES**. The two hardest constraints (correlation-not-causation, human-in-the-loop) were verified defended at the schema level. Fixes folded in above:

**P0 (build/correctness — applied):**
- **C2** — `profiles.niche` → `niche_description` (Task 10); the real column (`types.ts:438`), old name broke `tsc`/`build`.
- **C1** — `buildReplyFollowPairs` (Task 4) collapses multi-source `follower_snapshots` rows to one per day before diffing; extracted as a **pure, unit-tested** fn (broken inline `buildDailyPairs` removed).
- **C4** — cron route sets `maxDuration = 300`; single-profile dogfood budget documented, multi-profile sequential research deferred.
- **B5** — **resolved (decision #1 = option 1):** picks from `recommendTargets`; ONE batched `buildSeedScanPrompt` scan enriches the top picks' `suggested_approach` post-persist (best-effort, Task 10 + pure `mergeApproachScan` in Task 5). Composed, not rewritten — criterion #2 satisfied.

**P1 (applied):**
- **C3** — cron route uses the shared `cronAuthError` helper (constant-time, 500-on-unset) not an inline timing-leaky guard.
- **C5** — `recommendTargets` wrapped in a local try → cluster + attribution + snapshot persist even if target-gen fails.
- **D** — pure pair-builder extracted + tested (Task 4); Task 10's remaining orchestration may be split further during execution if heavy.

**Open / confirm at go-time:** B4 "10–20" may be fewer on cold-start (card flags thin data) · C6 (low) account vector is `niche_description`+pillars, consistent with `topics/board.ts`.
