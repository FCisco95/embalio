import { describe, it, expect, vi, beforeEach } from "vitest";

let upserted: { rows: Record<string, unknown>[]; options: unknown } | null = null;
let upsertError: { message: string } | null = null;
let analyticsRows: unknown[] = [];
let snapshotRows: unknown[] = [];
const activityInserts: Record<string, unknown>[] = [];

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    from: (table: string) => {
      if (table === "analytics_daily")
        return {
          upsert: async (rows: Record<string, unknown>[], options: unknown) => {
            upserted = { rows, options };
            return { error: upsertError };
          },
          select: () => ({ eq: () => ({ gte: () => ({ order: async () => ({ data: analyticsRows, error: null }) }) }) }),
        };
      if (table === "follower_snapshots")
        return { select: () => ({ eq: () => ({ gte: () => ({ order: async () => ({ data: snapshotRows, error: null }) }) }) }) };
      if (table === "activity_events")
        return { insert: async (row: Record<string, unknown>) => { activityInserts.push(row); return { error: null }; } };
      throw new Error(`unexpected ${table}`);
    },
  }),
}));

import { importAnalyticsCsv, getKpis, getFollowerStat } from "./kpis";

const CSV = [
  '"Date","Impressions","New follows","Profile visits"',
  '"Sat, Jun 6, 2026","1,200","5","150"',
  '"Sun, Jun 7, 2026","900","3","98"',
].join("\n");

beforeEach(() => {
  upserted = null;
  upsertError = null;
  analyticsRows = [];
  snapshotRows = [];
  activityInserts.length = 0;
});

describe("importAnalyticsCsv", () => {
  it("upserts normalized rows keyed on (profile_id,date) and logs csv_imported", async () => {
    const r = await importAnalyticsCsv("prof-1", CSV);
    expect(r).toMatchObject({ ok: true, imported: 2, rejected: [] });
    expect(upserted!.options).toMatchObject({ onConflict: "profile_id,date" });
    expect(upserted!.rows[0]).toMatchObject({ profile_id: "prof-1", date: "2026-06-06", profile_visits: 150, new_follows: 5 });
    expect(upserted!.rows[0].imported_at).toEqual(expect.any(String));
    expect(activityInserts[0]).toMatchObject({ kind: "csv_imported", profile_id: "prof-1" });
  });

  it("returns the loud header error without touching the DB", async () => {
    const r = await importAnalyticsCsv("prof-1", "Date,Impressions\n2026-06-07,5");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("missing required column");
    expect(upserted).toBeNull();
  });

  it("refuses an import where every row is bad, naming the first reason", async () => {
    const r = await importAnalyticsCsv("prof-1", '"Date","New follows","Profile visits"\n"garbage","1","2"');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("unparseable date");
  });

  it("surfaces a DB error", async () => {
    upsertError = { message: "boom" };
    const r = await importAnalyticsCsv("prof-1", CSV);
    expect(r).toEqual({ ok: false, error: "boom" });
  });

  it("imports good rows and reports rejected ones", async () => {
    const csv = ['"Date","New follows","Profile visits"', '"2026-06-06","5","150"', '"not a date","1","2"'].join("\n");
    const r = await importAnalyticsCsv("prof-1", csv);
    expect(r).toMatchObject({ ok: true, imported: 1 });
    if (r.ok) expect(r.rejected[0]).toMatchObject({ line: 3 });
  });
});

describe("getKpis", () => {
  it("aggregates DB rows into a KpiSummary", async () => {
    analyticsRows = [
      { date: "2026-06-06", profile_visits: 100, new_follows: 5, imported_at: "2026-06-08T00:00:00Z" },
      { date: "2026-06-07", profile_visits: 100, new_follows: 3, imported_at: "2026-06-08T00:00:00Z" },
    ];
    snapshotRows = [
      { snapshot_date: "2026-05-30", followers: 90, captured_at: "2026-05-30T07:30:00Z" },
      { snapshot_date: "2026-06-07", followers: 100, captured_at: "2026-06-07T07:30:00Z" },
    ];
    const k = await getKpis("prof-1");
    expect(k.followRate7d).toBeCloseTo(0.04);
    expect(k.followRateBand).toBe("good");
    expect(k.followerCount).toBe(100);
    expect(k.followerDelta7d).toBe(10);
    expect(k.dataThrough).toBe("2026-06-07");
  });
});

describe("getFollowerStat", () => {
  it("null when no snapshots", async () => {
    expect(await getFollowerStat("prof-1")).toBeNull();
  });
  it("returns the stat when snapshots exist", async () => {
    snapshotRows = [{ snapshot_date: "2026-06-07", followers: 100, captured_at: "2026-06-07T07:30:00Z" }];
    const s = await getFollowerStat("prof-1");
    expect(s).toMatchObject({ followers: 100, delta7d: null });
  });
});
