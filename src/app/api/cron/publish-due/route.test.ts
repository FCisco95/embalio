import { NextRequest } from "next/server";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ supabaseService: vi.fn() }));
vi.mock("@/server/publish", () => ({ publishDraft: vi.fn() }));
vi.mock("@/lib/x-api/client", () => ({ getXClientForProfile: vi.fn() }));

import { GET, maxDuration } from "@/app/api/cron/publish-due/route";
import { supabaseService } from "@/lib/supabase/server";
import { publishDraft } from "@/server/publish";
import { getXClientForProfile } from "@/lib/x-api/client";

const req = (auth?: string) =>
  new NextRequest("https://app.test/api/cron/publish-due", { headers: auth ? { authorization: auth } : {} });

function sbReturning(rows: Array<{ id: string }> | null, error: { message: string } | null = null) {
  const calls: Array<[string, ...unknown[]]> = [];
  const q: any = {
    select: (...a: unknown[]) => (calls.push(["select", ...a]), q),
    eq: (...a: unknown[]) => (calls.push(["eq", ...a]), q),
    lte: (...a: unknown[]) => (calls.push(["lte", ...a]), q),
    order: (...a: unknown[]) => (calls.push(["order", ...a]), q),
    limit: (...a: unknown[]) => (calls.push(["limit", ...a]), Promise.resolve({ data: rows, error })),
  };
  const sb = { from: vi.fn(() => q) };
  vi.mocked(supabaseService).mockReturnValue(sb as any);
  return { sb, calls };
}

describe("GET /api/cron/publish-due", () => {
  const saved = process.env.CRON_SECRET;
  beforeEach(() => {
    process.env.CRON_SECRET = "s3cret";
    vi.mocked(publishDraft).mockReset();
    vi.mocked(getXClientForProfile).mockReset();
    vi.mocked(supabaseService).mockReset();
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = saved;
  });

  it("caps the run at 60s", () => {
    expect(maxDuration).toBe(60);
  });

  it("401 without the bearer secret, and never touches the database", async () => {
    sbReturning([]);
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect((await GET(req("Bearer wrong"))).status).toBe(401);
    expect(supabaseService).not.toHaveBeenCalled();
    expect(publishDraft).not.toHaveBeenCalled();
  });

  it("selects only due scheduled originals, oldest first, max 10", async () => {
    const { sb, calls } = sbReturning([]);
    const before = Date.now();
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, due: 0, published: 0, failed: 0, skipped: 0, estimatedCostUsd: 0 });

    expect(sb.from).toHaveBeenCalledWith("drafts");
    expect(calls).toContainEqual(["eq", "status", "scheduled"]);
    expect(calls).toContainEqual(["eq", "kind", "original"]);
    const lte = calls.find((c) => c[0] === "lte")!;
    expect(lte[1]).toBe("scheduled_at");
    expect(new Date(lte[2] as string).getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(calls).toContainEqual(["order", "scheduled_at", { ascending: true }]);
    expect(calls).toContainEqual(["limit", 10]);
  });

  it("isolates drafts: one throwing does not stop the rest; counts published / failed / skipped", async () => {
    const { sb } = sbReturning([{ id: "d1" }, { id: "d2" }, { id: "d3" }, { id: "d4" }]);
    vi.mocked(publishDraft).mockImplementation(async (id: string) => {
      if (id === "d1") throw new Error("kaboom");
      if (id === "d2") return { ok: false, reason: "network down" };
      if (id === "d3") return { ok: false, reason: "already in progress or posted" };
      return { ok: true, url: "https://x.com/c/status/1" };
    });
    const res = await GET(req("Bearer s3cret"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(publishDraft).toHaveBeenCalledTimes(4);
    expect(publishDraft).toHaveBeenCalledWith("d4", sb, expect.any(Function));
    expect(body).toMatchObject({ ok: true, due: 4, published: 1, failed: 2, skipped: 1 });
  });

  it("sums the estimated X spend across the clients used", async () => {
    sbReturning([{ id: "d1" }, { id: "d2" }]);
    const costs: Record<string, number> = { "p-1": 0.215, "p-2": 0.015 };
    vi.mocked(getXClientForProfile).mockImplementation(async (pid: string) => ({ estimatedCostUsd: costs[pid] }) as any);
    vi.mocked(publishDraft).mockImplementation(async (id: string, sb: any, xFor: any) => {
      await xFor(id === "d1" ? "p-1" : "p-2", sb);
      return { ok: true, url: "u" };
    });
    const body = await (await GET(req("Bearer s3cret"))).json();
    expect(body.published).toBe(2);
    expect(body.estimatedCostUsd).toBeCloseTo(0.23, 6);
  });

  it("500 when the due query fails", async () => {
    sbReturning(null, { message: "db down" });
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ ok: false });
  });
});
