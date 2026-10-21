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
  it("reads original drafts in open statuses, newest first, via the RLS client", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const rows = [{ id: "d1" }, { id: "d2" }];
    const sb = { from: vi.fn(() => chain({ data: rows, error: null }, calls)) };
    vi.mocked(supabaseServer).mockResolvedValue(sb as any);

    expect(await listQueueDrafts("p-1")).toEqual(rows);
    expect(sb.from).toHaveBeenCalledWith("drafts");
    expect(calls).toContainEqual(["eq", "profile_id", "p-1"]);
    expect(calls).toContainEqual(["eq", "kind", "original"]);
    expect(calls).toContainEqual(["in", "status", ["draft", "approved", "scheduled"]]);
    expect(calls).toContainEqual(["order", "created_at", { ascending: false }]);
    const select = calls.find((c) => c[0] === "select")![1] as string;
    for (const col of ["id", "body", "angle", "rationale", "link_url", "scheduled_at", "status", "created_at"]) {
      expect(select).toContain(col);
    }
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
