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
