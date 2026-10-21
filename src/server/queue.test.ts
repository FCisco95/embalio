import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ supabaseServer: vi.fn(), supabaseService: vi.fn() }));
vi.mock("@/server/auth", () => ({ assertOwnProfile: vi.fn() }));

import { getXConnection, listQueueDrafts } from "@/server/queue";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";
import { assertOwnProfile } from "@/server/auth";

function chain(result: any, calls: Array<[string, ...unknown[]]>) {
  const q: any = {
    select: (...a: unknown[]) => (calls.push(["select", ...a]), q),
    eq: (...a: unknown[]) => (calls.push(["eq", ...a]), q),
    in: (...a: unknown[]) => (calls.push(["in", ...a]), q),
    order: (...a: unknown[]) => (calls.push(["order", ...a]), Promise.resolve(result)),
    maybeSingle: () => Promise.resolve(result),
  };
  return q;
}

describe("listQueueDrafts", () => {
  it("reads original drafts in open statuses (incl. unconfirmed maybe-sent ones), newest first, via the RLS client", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const rows = [{ id: "d1" }, { id: "d2" }];
    const sb = {
      from: vi.fn((t: string) => chain(t === "drafts" ? { data: rows, error: null } : { data: [], error: null }, t === "drafts" ? calls : [])),
    };
    vi.mocked(supabaseServer).mockResolvedValue(sb as any);

    expect(await listQueueDrafts("p-1")).toEqual([
      { id: "d1", last_error: null },
      { id: "d2", last_error: null },
    ]);
    expect(sb.from).toHaveBeenCalledWith("drafts");
    expect(calls).toContainEqual(["eq", "profile_id", "p-1"]);
    expect(calls).toContainEqual(["eq", "kind", "original"]);
    expect(calls).toContainEqual(["in", "status", ["draft", "approved", "scheduled", "unconfirmed"]]);
    expect(calls).toContainEqual(["order", "created_at", { ascending: false }]);
    const select = calls.find((c) => c[0] === "select")![1] as string;
    for (const col of ["id", "body", "angle", "rationale", "link_url", "scheduled_at", "status", "created_at"]) {
      expect(select).toContain(col);
    }
  });

  it("attaches the latest posting_jobs error per draft as last_error", async () => {
    const jobCalls: Array<[string, ...unknown[]]> = [];
    const drafts = [{ id: "d1" }, { id: "d2" }, { id: "d3" }];
    // newest first: d1's latest job failed; d2's latest job has no error (older one had); d3 has no jobs
    const jobs = [
      { draft_id: "d1", error: "X API 403", created_at: "2030-01-03" },
      { draft_id: "d2", error: null, created_at: "2030-01-03" },
      { draft_id: "d1", error: "old failure", created_at: "2030-01-01" },
      { draft_id: "d2", error: "older failure", created_at: "2030-01-01" },
    ];
    const sb = {
      from: vi.fn((t: string) =>
        t === "drafts" ? chain({ data: drafts, error: null }, []) : chain({ data: jobs, error: null }, jobCalls),
      ),
    };
    vi.mocked(supabaseServer).mockResolvedValue(sb as any);

    const out = await listQueueDrafts("p-1");
    expect(out.map((d) => [d.id, d.last_error])).toEqual([["d1", "X API 403"], ["d2", null], ["d3", null]]);
    expect(sb.from).toHaveBeenCalledWith("posting_jobs");
    expect(jobCalls).toContainEqual(["in", "draft_id", ["d1", "d2", "d3"]]);
    expect(jobCalls).toContainEqual(["order", "created_at", { ascending: false }]);
  });

  it("skips the job lookup when there are no drafts", async () => {
    const sb = { from: vi.fn(() => chain({ data: [], error: null }, [])) };
    vi.mocked(supabaseServer).mockResolvedValue(sb as any);
    expect(await listQueueDrafts("p-1")).toEqual([]);
    expect(sb.from).toHaveBeenCalledTimes(1);
  });

  it("a failed job lookup degrades to last_error null instead of hiding the queue", async () => {
    const sb = {
      from: vi.fn((t: string) =>
        t === "drafts" ? chain({ data: [{ id: "d1" }], error: null }, []) : chain({ data: null, error: { message: "nope" } }, []),
      ),
    };
    vi.mocked(supabaseServer).mockResolvedValue(sb as any);
    expect(await listQueueDrafts("p-1")).toEqual([{ id: "d1", last_error: null }]);
  });

  it("throws on a database error", async () => {
    const sb = { from: () => chain({ data: null, error: { message: "boom" } }, []) };
    vi.mocked(supabaseServer).mockResolvedValue(sb as any);
    await expect(listQueueDrafts("p-1")).rejects.toThrow("boom");
  });
});

describe("getXConnection", () => {
  beforeEach(() => {
    vi.mocked(assertOwnProfile).mockReset().mockResolvedValue(undefined);
  });

  const withRow = (row: any) => {
    const calls: Array<[string, ...unknown[]]> = [];
    const sb = { from: vi.fn(() => chain({ data: row, error: null }, calls)) };
    vi.mocked(supabaseService).mockReturnValue(sb as any);
    return { sb, calls };
  };

  it("checks ownership first and never selects token columns", async () => {
    const { calls } = withRow(null);
    await getXConnection("p-1");
    expect(assertOwnProfile).toHaveBeenCalledWith("p-1");
    const select = calls.find((c) => c[0] === "select")![1] as string;
    expect(select).not.toMatch(/token/);
  });

  it("not connected when there is no row", async () => {
    withRow(null);
    expect(await getXConnection("p-1")).toEqual({ connected: false });
  });

  it("connected with the handle", async () => {
    withRow({ x_username: "cisco", needs_reauth: false });
    expect(await getXConnection("p-1")).toEqual({ connected: true, username: "cisco", needsReauth: false });
  });

  it("flags needsReauth", async () => {
    withRow({ x_username: "cisco", needs_reauth: true });
    expect(await getXConnection("p-1")).toEqual({ connected: true, username: "cisco", needsReauth: true });
  });

  it("propagates an ownership failure and does not read", async () => {
    vi.mocked(assertOwnProfile).mockRejectedValue(new Error("Profile not found or access denied"));
    const { sb } = withRow(null);
    await expect(getXConnection("p-2")).rejects.toThrow(/access denied/);
    expect(sb.from).not.toHaveBeenCalled();
  });
});
