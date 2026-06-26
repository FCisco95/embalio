import { describe, it, expect, vi, beforeEach } from "vitest";

let alertRows: unknown[];
let alertErr: { message: string } | null;
let visitRows: unknown[];
let visitErr: { message: string } | null;

// Generic thenable query-builder: every method returns the builder, and awaiting
// it anywhere in the chain resolves to {data,error}. Covers both the
// getGateScorecard chains (select.eq.in.gte / select.eq.gte.order) and
// listRecentActedAlerts (select.eq.eq.gte.order.limit).
function builder(result: () => { data: unknown; error: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {};
  for (const m of ["select", "eq", "in", "gte", "lte", "order", "limit"]) b[m] = () => b;
  b.then = (res: (v: { data: unknown; error: unknown }) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(result()).then(res, rej);
  return b;
}

vi.mock("@/lib/supabase/server", () => ({
  supabaseService: () => ({
    from: (t: string) => {
      if (t === "sniper_alerts") return builder(() => ({ data: alertRows, error: alertErr }));
      if (t === "analytics_daily") return builder(() => ({ data: visitRows, error: visitErr }));
      throw new Error(`unexpected ${t}`);
    },
  }),
}));

import { getGateScorecard, listRecentActedAlerts } from "./gate";

const acted = (sent_at: string) => ({
  status: "acted",
  skip_reason: null,
  reply_impressions: null,
  author_median_reply_impressions: null,
  author_reply_back: null,
  sent_at,
});
const dismissed = (skip_reason: string) => ({
  status: "dismissed",
  skip_reason,
  reply_impressions: null,
  author_median_reply_impressions: null,
  author_reply_back: null,
  sent_at: null,
});

beforeEach(() => {
  alertRows = [];
  alertErr = null;
  visitRows = [];
  visitErr = null;
});

describe("getGateScorecard", () => {
  it("reduces alert + visit rows into the scorecard", async () => {
    alertRows = [
      ...Array.from({ length: 7 }, () => acted("2026-06-10T10:00:00Z")),
      ...Array.from({ length: 3 }, () => dismissed("bait")),
    ];
    visitRows = [
      { date: "2026-06-10", profile_visits: 200 }, // reply day
      { date: "2026-06-11", profile_visits: 100 }, // baseline
    ];
    const s = await getGateScorecard("p1");
    expect(s.precision).toBeCloseTo(0.7);
    expect(s.skipBreakdown.bait).toBe(3);
    expect(s.replyDayVisitLift).toBeCloseTo(1.0);
    expect(s.windowDays).toBe(45);
    expect(s.dataThrough).toBe("2026-06-11");
  });

  it("honours a custom window and reports null dataThrough with no visits", async () => {
    const s = await getGateScorecard("p1", { windowDays: 14 });
    expect(s.windowDays).toBe(14);
    expect(s.dataThrough).toBeNull();
  });

  it("throws on an alerts read error", async () => {
    alertErr = { message: "alerts boom" };
    await expect(getGateScorecard("p1")).rejects.toThrow("alerts boom");
  });

  it("throws on a visits read error", async () => {
    visitErr = { message: "visits boom" };
    await expect(getGateScorecard("p1")).rejects.toThrow("visits boom");
  });
});

describe("listRecentActedAlerts", () => {
  it("returns the acted-alert rows", async () => {
    alertRows = [
      {
        id: "a1",
        author_handle: "kai",
        tweet_text: "hi",
        tweet_url: "https://x/1",
        sent_at: "2026-06-10T10:00:00Z",
        reply_impressions: null,
        author_median_reply_impressions: null,
        author_reply_back: null,
      },
    ];
    const rows = await listRecentActedAlerts("p1");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "a1", author_handle: "kai" });
  });

  it("returns [] when no acted alerts", async () => {
    expect(await listRecentActedAlerts("p1")).toEqual([]);
  });

  it("throws on a read error", async () => {
    alertErr = { message: "list boom" };
    await expect(listRecentActedAlerts("p1")).rejects.toThrow("list boom");
  });
});
