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
