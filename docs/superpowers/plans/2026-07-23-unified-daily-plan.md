# Unified Daily Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the home coach card into ONE ordered checklist for today: the assignment (existing `pickAssignment`) + top topic-board pick ("Draft this" → /topics) + pending manual-outcome reminders (acted alerts with NULL `reply_impressions` → /performance/gate-2) + CSV re-import reminder when `analytics_daily` is >7 days stale.

**Architecture:** Pure lib `src/lib/coach/daily-plan.ts` (`buildDailyPlan(inputs) → DailyPlanItem[]`, fully unit-tested, date injected for purity) + read-only server aggregator `src/server/daily-plan.ts` (`getDailyPlan(profileId)` composing existing reads — NO new tables, NO writes) + `src/components/daily-plan-card.tsx` replacing `CoachCard` usage on the home page (CoachCard file stays; only the home page swaps).

**Tech Stack:** vitest; existing server reads (`getDailyAssignment`, `getTopicBoard`, supabase selects).

**Freeze-safe:** no P4/P6 imports. Read-only aggregation.

---

### Task 1: Pure lib — `buildDailyPlan`

**Files:**
- Create: `src/lib/coach/daily-plan.ts`
- Test: `src/lib/coach/daily-plan.test.ts`

- [ ] **Step 1: Failing tests**

```ts
// src/lib/coach/daily-plan.test.ts
import { describe, it, expect } from "vitest";
import { buildDailyPlan, type DailyPlanInputs } from "./daily-plan";
import type { DailyAssignment } from "./assignment";

const postAssignment: DailyAssignment = {
  kind: "post",
  task: "Post today — pick an angle.",
  why: "why",
  nextAction: "Open Compose.",
};

const base: DailyPlanInputs = {
  assignment: postAssignment,
  topTopic: { id: "t1", topic: "MCP agents", angle: "the 0.66% OON angle", score: 82 },
  pendingOutcomes: 2,
  analyticsDataThrough: "2026-07-20",
  todayIso: "2026-07-23",
};

describe("buildDailyPlan — ordering and content", () => {
  it("orders: assignment → topic → outcomes → csv (csv only when stale)", () => {
    const items = buildDailyPlan({ ...base, analyticsDataThrough: "2026-07-01" });
    expect(items.map((i) => i.kind)).toEqual(["assignment", "topic", "outcomes", "csv"]);
  });

  it("assignment item carries the pickAssignment fields and routes by kind", () => {
    const items = buildDailyPlan(base);
    const a = items[0];
    expect(a.title).toBe(postAssignment.task);
    expect(a.detail).toBe(postAssignment.nextAction);
    expect(a.href).toBe("/compose");
    const replyItems = buildDailyPlan({
      ...base,
      assignment: { kind: "reply", task: "Reply to 5 more.", why: "w", nextAction: "n" },
    });
    expect(replyItems[0].href).toBe("/engage");
  });

  it("rest assignment renders as done", () => {
    const items = buildDailyPlan({
      ...base,
      assignment: { kind: "rest", task: "You're done for today.", why: "w", nextAction: "n" },
    });
    expect(items[0].done).toBe(true);
  });

  it("topic item shows topic + angle with Draft-this link to /topics", () => {
    const t = buildDailyPlan(base).find((i) => i.kind === "topic");
    expect(t).toMatchObject({ href: "/topics", cta: "Draft this" });
    expect(t?.title).toContain("MCP agents");
    expect(t?.detail).toContain("0.66%");
  });

  it("no topic item when board is empty", () => {
    const items = buildDailyPlan({ ...base, topTopic: null });
    expect(items.some((i) => i.kind === "topic")).toBe(false);
  });

  it("outcomes item counts pending and links to gate-2; absent at 0", () => {
    const o = buildDailyPlan(base).find((i) => i.kind === "outcomes");
    expect(o).toMatchObject({ href: "/performance/gate-2" });
    expect(o?.title).toContain("2");
    expect(buildDailyPlan({ ...base, pendingOutcomes: 0 }).some((i) => i.kind === "outcomes")).toBe(false);
  });

  it("csv reminder only when analytics_daily is >7 days stale (or missing entirely)", () => {
    expect(buildDailyPlan({ ...base, analyticsDataThrough: "2026-07-17" }).some((i) => i.kind === "csv")).toBe(false); // 6 days
    expect(buildDailyPlan({ ...base, analyticsDataThrough: "2026-07-15" }).some((i) => i.kind === "csv")).toBe(true);  // 8 days
    const missing = buildDailyPlan({ ...base, analyticsDataThrough: null }).find((i) => i.kind === "csv");
    expect(missing).toBeDefined();
    expect(missing?.href).toBe("/performance");
  });

  it("boundary: exactly 7 days stale → no reminder (spec says >7)", () => {
    expect(buildDailyPlan({ ...base, analyticsDataThrough: "2026-07-16" }).some((i) => i.kind === "csv")).toBe(false);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/lib/coach/daily-plan.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implementation**

```ts
// src/lib/coach/daily-plan.ts
/**
 * Unified daily plan: the home card's single ordered checklist for today.
 * Pure derivation over already-fetched inputs — the server aggregator
 * (src/server/daily-plan.ts) does the reads, this decides what to show.
 * Order is fixed: do the assignment, then the best topic, then clear data
 * debt (pending reply outcomes, stale analytics CSV).
 */
import type { DailyAssignment } from "./assignment";

export interface DailyPlanTopic {
  id: string;
  topic: string;
  angle: string;
  score: number;
}

export interface DailyPlanInputs {
  assignment: DailyAssignment;
  topTopic: DailyPlanTopic | null;
  /** acted alerts with NULL reply_impressions (GATE-2 scorecard is starving). */
  pendingOutcomes: number;
  /** newest analytics_daily.date (YYYY-MM-DD) or null when none imported. */
  analyticsDataThrough: string | null;
  /** today as YYYY-MM-DD (UTC) — injected so the lib stays pure/testable. */
  todayIso: string;
}

export interface DailyPlanItem {
  kind: "assignment" | "topic" | "outcomes" | "csv";
  title: string;
  detail?: string;
  href: string;
  cta: string;
  /** true renders as checked-off (rest day: assignment complete). */
  done?: boolean;
}

const CSV_STALE_DAYS = 7;

const daysBetween = (fromIso: string, toIso: string): number =>
  Math.floor((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);

export function buildDailyPlan(i: DailyPlanInputs): DailyPlanItem[] {
  const items: DailyPlanItem[] = [];

  items.push({
    kind: "assignment",
    title: i.assignment.task,
    detail: i.assignment.nextAction,
    href: i.assignment.kind === "reply" ? "/engage" : "/compose",
    cta: i.assignment.kind === "reply" ? "Open Engage" : "Open Compose",
    done: i.assignment.kind === "rest",
  });

  if (i.topTopic) {
    items.push({
      kind: "topic",
      title: `Top topic: ${i.topTopic.topic}`,
      detail: i.topTopic.angle || undefined,
      href: "/topics",
      cta: "Draft this",
    });
  }

  if (i.pendingOutcomes > 0) {
    items.push({
      kind: "outcomes",
      title: `${i.pendingOutcomes} sent repl${i.pendingOutcomes === 1 ? "y" : "ies"} missing outcomes`,
      detail: "Read impressions off the X app and log them — the GATE-2 scorecard can't compute without them.",
      href: "/performance/gate-2",
      cta: "Log outcomes",
    });
  }

  const stale =
    i.analyticsDataThrough === null || daysBetween(i.analyticsDataThrough, i.todayIso) > CSV_STALE_DAYS;
  if (stale) {
    items.push({
      kind: "csv",
      title:
        i.analyticsDataThrough === null
          ? "No analytics imported yet"
          : `Analytics stale — last import ${i.analyticsDataThrough}`,
      detail: "Export the X analytics CSV and re-import so visit-lift stays current.",
      href: "/performance",
      cta: "Import CSV",
    });
  }

  return items;
}
```

- [ ] **Step 4:** `npx vitest run src/lib/coach/daily-plan.test.ts` → PASS (9 tests).
- [ ] **Step 5: Commit** — `git add src/lib/coach/daily-plan.ts src/lib/coach/daily-plan.test.ts && git commit -m "feat(coach): buildDailyPlan — pure unified daily checklist derivation"`

---

### Task 2: Server aggregator — `getDailyPlan`

**Files:**
- Create: `src/server/daily-plan.ts`
- Test: `src/server/daily-plan.test.ts`

- [ ] **Step 1: Failing tests** — boundary-mock `@/server/coach`, `@/server/topics`, `@/lib/supabase/server` (service client for the two small selects). House style: `src/server/sniper-outcome.test.ts`.

```ts
// src/server/daily-plan.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

let assignment: Record<string, unknown>;
let board: Record<string, unknown>;
let pendingCount: number | null;
let latestAnalyticsRows: { date: string }[];

vi.mock("@/server/coach", () => ({
  getDailyAssignment: async () => assignment,
}));
vi.mock("@/server/topics", () => ({
  getTopicBoard: async () => board,
}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseService: () => ({
    from: (t: string) => {
      if (t === "sniper_alerts") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                is: async () => ({ count: pendingCount, error: null }),
              }),
            }),
          }),
        };
      }
      if (t === "analytics_daily") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({ limit: async () => ({ data: latestAnalyticsRows, error: null }) }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${t}`);
    },
  }),
}));

import { getDailyPlan } from "./daily-plan";

beforeEach(() => {
  assignment = { kind: "post", task: "Post today.", why: "w", nextAction: "Open Compose." };
  board = {
    state: "fresh",
    generatedAt: "2026-07-23T08:00:00Z",
    topics: [{ id: "t1", topic: "MCP", angle: "angle", score: 90 }],
  };
  pendingCount = 2;
  latestAnalyticsRows = [{ date: "2026-07-01" }];
});

describe("getDailyPlan", () => {
  it("aggregates assignment + top topic + pending outcomes + stale csv into ordered items", async () => {
    const plan = await getDailyPlan("p1");
    expect(plan.items.map((i) => i.kind)).toEqual(["assignment", "topic", "outcomes", "csv"]);
  });

  it("empty topic board → no topic item", async () => {
    board = { state: "empty", generatedAt: null, topics: [] };
    const plan = await getDailyPlan("p1");
    expect(plan.items.some((i) => i.kind === "topic")).toBe(false);
  });

  it("zero pending outcomes → no outcomes item", async () => {
    pendingCount = 0;
    const plan = await getDailyPlan("p1");
    expect(plan.items.some((i) => i.kind === "outcomes")).toBe(false);
  });

  it("null count from supabase is treated as 0", async () => {
    pendingCount = null;
    const plan = await getDailyPlan("p1");
    expect(plan.items.some((i) => i.kind === "outcomes")).toBe(false);
  });

  it("no analytics rows → csv reminder present", async () => {
    latestAnalyticsRows = [];
    const plan = await getDailyPlan("p1");
    expect(plan.items.some((i) => i.kind === "csv")).toBe(true);
  });
});
```

- [ ] **Step 2:** run → FAIL.

- [ ] **Step 3: Implementation**

```ts
// src/server/daily-plan.ts
import { supabaseService } from "@/lib/supabase/server";
import { getDailyAssignment } from "@/server/coach";
import { getTopicBoard } from "@/server/topics";
import { buildDailyPlan, type DailyPlanItem } from "@/lib/coach/daily-plan";

export interface DailyPlanView {
  items: DailyPlanItem[];
}

/**
 * Read-only aggregation for the home checklist: existing assignment + topic
 * board reads, plus two tiny selects (pending outcome count, newest analytics
 * date). No new tables, no writes, no P4/P6 touch.
 */
export async function getDailyPlan(profileId: string): Promise<DailyPlanView> {
  const sb = supabaseService();

  const [assignment, boardResult, pendingResult, analyticsResult] = await Promise.all([
    getDailyAssignment(profileId),
    getTopicBoard(profileId).catch(() => ({ state: "empty" as const, generatedAt: null, topics: [] })),
    sb
      .from("sniper_alerts")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .eq("status", "acted")
      .is("reply_impressions", null),
    sb
      .from("analytics_daily")
      .select("date")
      .eq("profile_id", profileId)
      .order("date", { ascending: false })
      .limit(1),
  ]);

  const top = boardResult.topics[0] ?? null;
  const items = buildDailyPlan({
    assignment,
    topTopic: top ? { id: top.id, topic: top.topic, angle: top.angle, score: top.score } : null,
    pendingOutcomes: pendingResult.count ?? 0,
    analyticsDataThrough: analyticsResult.data?.[0]?.date ?? null,
    todayIso: new Date().toISOString().slice(0, 10),
  });
  return { items };
}
```

**Mock-shape caution:** the test mocks the two supabase chains with the exact call orders used above (`select→eq→eq→is` awaited for the count; `select→eq→order→limit` awaited for analytics). If implementation chain order differs, align the implementation to the mock (it matches supabase-js semantics). The count call uses `{ count: "exact", head: true }` — the mock ignores the options object; assert only on the resolved `count`.

- [ ] **Step 4:** `npx vitest run src/server/daily-plan.test.ts` → PASS (5 tests).
- [ ] **Step 5:** `npx tsc --noEmit && npm test` → clean/green.
- [ ] **Step 6: Commit** — `git add src/server/daily-plan.ts src/server/daily-plan.test.ts && git commit -m "feat(coach): getDailyPlan read-only aggregator for the home checklist"`

---

### Task 3: UI — `DailyPlanCard` replaces CoachCard on home

**Files:**
- Create: `src/components/daily-plan-card.tsx`
- Modify: `src/app/(app)/page.tsx` (swap CoachCard usage; keep `coach-card.tsx` file untouched)

- [ ] **Step 1: Component**

```tsx
// src/components/daily-plan-card.tsx
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Circle } from "lucide-react";
import type { DailyPlanView } from "@/server/daily-plan";

/** The home card: one ordered checklist for today. Read-only; each row links out. */
export function DailyPlanCard({ plan }: { plan: DailyPlanView }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Today&apos;s plan
        </span>
        <ol className="flex flex-col gap-2.5">
          {plan.items.map((item) => (
            <li key={item.kind} className="flex items-start gap-2.5">
              {item.done ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={1.8} />
              ) : (
                <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
              )}
              <div className="min-w-0 flex-1">
                <p className={`text-[13.5px] font-medium ${item.done ? "line-through text-muted-foreground" : ""}`}>
                  {item.title}
                </p>
                {item.detail && (
                  <p className="text-[12.5px] leading-snug text-muted-foreground">{item.detail}</p>
                )}
              </div>
              {!item.done && (
                <Link
                  href={item.href}
                  className="shrink-0 rounded-md border border-border px-2 py-1 text-[11.5px] font-medium text-muted-foreground hover:text-foreground"
                >
                  {item.cta}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Swap on home page.** In `src/app/(app)/page.tsx`:
- Replace import `getDailyAssignment` usage: add `import { getDailyPlan } from "@/server/daily-plan"` and `import { DailyPlanCard } from "@/components/daily-plan-card"`; remove the now-unused `getDailyAssignment` + `CoachCard` imports.
- Replace the `assignment` state variable with `dailyPlan: Awaited<ReturnType<typeof getDailyPlan>> | null = null`, fetched in the same try block: `dailyPlan = await getDailyPlan(profile.id)` (replacing the `assignment = await getDailyAssignment(profile.id)` line).
- Replace `{assignment && <CoachCard assignment={assignment} />}` with `{dailyPlan && <DailyPlanCard plan={dailyPlan} />}`.

- [ ] **Step 3:** `npx tsc --noEmit && npm test && npm run build` → clean/green.
- [ ] **Step 4: Commit** — `git add src/components/daily-plan-card.tsx "src/app/(app)/page.tsx" && git commit -m "feat(home): unified daily plan card — assignment, top topic, outcome + CSV reminders"`

---

### Task 4: Ship
- [ ] `git push origin main` → Vercel auto-deploy → `curl` 200 on `/` (root serves the dashboard).

---

## Self-review notes
- No new tables ✅; two tiny read selects only.
- getTopicBoard `.catch` guard: board read failure degrades to no topic item, never kills the home page.
- `getDailyAssignment` may itself call `findHotTopics` (LLM-backed) when not posted — pre-existing behavior of the coach card, unchanged.
- Rest day renders item checked, no dangling CTA.
- P4/P6 untouched.
