import { describe, it, expect, vi, beforeEach } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";

const requireActiveProfile = vi.fn();
const listQueueDrafts = vi.fn();
const getXConnection = vi.fn();
vi.mock("@/server/active-profile", () => ({ requireActiveProfile: () => requireActiveProfile() }));
vi.mock("@/server/queue", () => ({
  listQueueDrafts: (...a: unknown[]) => listQueueDrafts(...a),
  getXConnection: (...a: unknown[]) => getXConnection(...a),
}));
vi.mock("@/server/dashboard", () => ({
  getDashboardData: async () => ({ reach: { total: 0, delta: null, series: [] }, topPost: null, strategy: null, targets: [] }),
}));
vi.mock("@/server/growth-plan", () => ({ getGrowthPlan: async () => null }));
vi.mock("@/server/daily-plan", () => ({ getDailyPlan: async () => ({ plan: true }) }));
vi.mock("@/server/streak", () => ({ getStreak: async () => 0 }));
vi.mock("@/server/kpis", () => ({ getFollowerStat: async () => null }));
vi.mock("@/server/weekly-activity", () => ({ getWeeklyActivity: async () => null }));
vi.mock("@/lib/setup-logic", () => ({ needsSetup: () => false }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`REDIRECT:${to}`); } }));

vi.mock("@/components/approval-queue", () => ({ ApprovalQueue: () => null }));
vi.mock("@/components/daily-plan-card", () => ({ DailyPlanCard: () => null }));
vi.mock("@/components/growth-plan-card", () => ({ GrowthPlanCard: () => null }));
vi.mock("@/components/follower-card", () => ({ FollowerCard: () => null }));
vi.mock("@/components/streak-badge", () => ({ StreakBadge: () => null }));
vi.mock("@/components/weekly-system-card", () => ({ WeeklySystemCard: () => null }));
vi.mock("@/components/charts/area-chart", () => ({ AreaChart: () => null }));

import DashboardPage from "./page";
import { ApprovalQueue as QueueMock } from "@/components/approval-queue";
import { DailyPlanCard as PlanMock } from "@/components/daily-plan-card";

/** Depth-first walk of the element tree returned by the (async) server component. */
function walk(node: ReactNode, visit: (el: ReactElement<Record<string, unknown>>) => void): void {
  if (Array.isArray(node)) return node.forEach((n) => walk(n, visit));
  if (!isValidElement(node)) return;
  const el = node as ReactElement<Record<string, unknown>>;
  visit(el);
  walk(el.props.children as ReactNode, visit);
}

function order(tree: ReactNode): Array<"queue" | "plan"> {
  const seen: Array<"queue" | "plan"> = [];
  walk(tree, (el) => {
    if (el.type === QueueMock) seen.push("queue");
    if (el.type === PlanMock) seen.push("plan");
  });
  return seen;
}

function findQueue(tree: ReactNode): ReactElement<Record<string, unknown>> | undefined {
  let found: ReactElement<Record<string, unknown>> | undefined;
  walk(tree, (el) => { if (el.type === QueueMock) found = el; });
  return found;
}

const drafts = [{ id: "d1", body: "hello", status: "draft" }];
const x = { connected: true, username: "cisco" };

beforeEach(() => {
  requireActiveProfile.mockReset().mockResolvedValue({ id: "p-active", handle: "cisco" });
  listQueueDrafts.mockReset().mockResolvedValue(drafts);
  getXConnection.mockReset().mockResolvedValue(x);
});

describe("Hoje (/) approval queue", () => {
  it("reads the queue + X link for the ACTIVE profile and renders <ApprovalQueue> with them", async () => {
    const tree = await DashboardPage();
    expect(listQueueDrafts).toHaveBeenCalledWith("p-active");
    expect(getXConnection).toHaveBeenCalledWith("p-active");
    expect(findQueue(tree)?.props).toEqual({ profileId: "p-active", drafts, x });
  });

  it("renders the queue before the daily plan (first section under the header)", async () => {
    expect(order(await DashboardPage())).toEqual(["queue", "plan"]);
  });

  it("degrades to an empty, not-connected queue when the queue reads fail", async () => {
    listQueueDrafts.mockRejectedValue(new Error("db down"));
    getXConnection.mockRejectedValue(new Error("db down"));
    const q = findQueue(await DashboardPage());
    expect(q?.props).toEqual({ profileId: "p-active", drafts: [], x: { connected: false } });
  });
});
