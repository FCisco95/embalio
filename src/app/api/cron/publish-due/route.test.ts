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

type Calls = Array<[string, ...unknown[]]>;

/** Universal chainable + thenable: every method records itself; awaiting resolves to `result`. */
function chain(result: unknown, calls: Calls): any {
  const q: any = new Proxy(
    {},
    {
      get: (_t, prop: string) => {
        if (prop === "then") return (res: any, rej: any) => Promise.resolve(result).then(res, rej);
        return (...a: unknown[]) => (calls.push([prop, ...a]), q);
      },
    },
  );
  return q;
}

function makeSb({
  due = [] as Array<{ id: string }>,
  dueError = null as { message: string } | null,
  stuck = [] as Array<{ id: string; draft_id: string }>,
  reapError = null as { message: string } | null,
} = {}) {
  const log = { due: [] as Calls, reapSelect: [] as Calls, jobUpdates: [] as Calls, draftUpdates: [] as Calls };
  const sb = {
    from: vi.fn((table: string) => {
      if (table === "drafts") {
        return {
          select: (...a: unknown[]) => (log.due.push(["select", ...a]), chain({ data: dueError ? null : due, error: dueError }, log.due)),
          update: (...a: unknown[]) => (log.draftUpdates.push(["update", ...a]), chain({ error: null }, log.draftUpdates)),
        };
      }
      return {
        select: (...a: unknown[]) => (log.reapSelect.push(["select", ...a]), chain({ data: reapError ? null : stuck, error: reapError }, log.reapSelect)),
        update: (...a: unknown[]) => (log.jobUpdates.push(["update", ...a]), chain({ error: null }, log.jobUpdates)),
      };
    }),
  };
  vi.mocked(supabaseService).mockReturnValue(sb as any);
  return { sb, log };
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
    vi.restoreAllMocks();
    if (saved === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = saved;
  });

  it("caps the run at 60s", () => {
    expect(maxDuration).toBe(60);
  });

  it("401 without the bearer secret, and never touches the database", async () => {
    makeSb();
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer wrong"))).status).toBe(401);
    expect(supabaseService).not.toHaveBeenCalled();
    expect(publishDraft).not.toHaveBeenCalled();
  });

  it("selects only due scheduled originals, oldest first, max 10", async () => {
    const { sb, log } = makeSb();
    const before = Date.now();
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, due: 0, published: 0, failed: 0, skipped: 0, deferred: 0, reaped: 0, estimatedCostUsd: 0 });

    expect(sb.from).toHaveBeenCalledWith("drafts");
    expect(log.due).toContainEqual(["eq", "status", "scheduled"]);
    expect(log.due).toContainEqual(["eq", "kind", "original"]);
    const lte = log.due.find((c) => c[0] === "lte")!;
    expect(lte[1]).toBe("scheduled_at");
    expect(new Date(lte[2] as string).getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(log.due).toContainEqual(["order", "scheduled_at", { ascending: true }]);
    expect(log.due).toContainEqual(["limit", 10]);
  });

  it("isolates drafts: one throwing does not stop the rest; counts published / failed / skipped", async () => {
    const { sb } = makeSb({ due: [{ id: "d1" }, { id: "d2" }, { id: "d3" }, { id: "d4" }] });
    vi.spyOn(console, "error").mockImplementation(() => {});
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
    expect(body).toMatchObject({ ok: true, due: 4, published: 1, failed: 2, skipped: 1, deferred: 0 });
  });

  it("sums the estimated X spend across the clients used", async () => {
    makeSb({ due: [{ id: "d1" }, { id: "d2" }] });
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
    makeSb({ dueError: { message: "db down" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ ok: false });
  });

  describe("time budget", () => {
    it("stops dispatching after ~45s and reports the rest as deferred", async () => {
      makeSb({ due: [{ id: "d1" }, { id: "d2" }, { id: "d3" }, { id: "d4" }] });
      let now = 1_000_000;
      vi.spyOn(Date, "now").mockImplementation(() => now);
      vi.mocked(publishDraft).mockImplementation(async () => {
        now += 20_000; // each publish "takes" 20s
        return { ok: true, url: "u" };
      });
      const body = await (await GET(req("Bearer s3cret"))).json();
      // t=0 -> d1, t=20 -> d2, t=40 -> d3, t=60 > 45 -> d4 deferred
      expect(publishDraft).toHaveBeenCalledTimes(3);
      expect(body).toMatchObject({ due: 4, published: 3, deferred: 1 });
    });
  });

  describe("reaping stuck running jobs", () => {
    it("parks jobs left 'running' >10 min as needs_manual_confirmation (never failed: the tweet may be live) and their drafts as unconfirmed", async () => {
      const { log } = makeSb({ stuck: [{ id: "j1", draft_id: "d1" }, { id: "j2", draft_id: "d2" }] });
      const before = Date.now();
      const body = await (await GET(req("Bearer s3cret"))).json();

      expect(log.reapSelect).toContainEqual(["eq", "status", "running"]);
      expect(log.reapSelect).toContainEqual(["eq", "method", "xapi"]);
      const lt = log.reapSelect.find((c) => c[0] === "lt")!;
      expect(lt[1]).toBe("updated_at");
      const cutoff = new Date(lt[2] as string).getTime();
      expect(before - cutoff).toBeGreaterThanOrEqual(10 * 60_000 - 1000);
      expect(before - cutoff).toBeLessThan(11 * 60_000);

      expect(log.jobUpdates[0][1]).toMatchObject({ status: "needs_manual_confirmation", error: expect.stringMatching(/timed out|verify/i) });
      expect(log.jobUpdates).toContainEqual(["in", "id", ["j1", "j2"]]);
      expect(log.draftUpdates[0][1]).toEqual({ status: "unconfirmed" });
      expect(log.draftUpdates).toContainEqual(["in", "id", ["d1", "d2"]]);
      expect(log.draftUpdates).toContainEqual(["in", "status", ["scheduled", "approved"]]);
      expect(body.reaped).toBe(2);
    });

    it("does nothing when no job is stuck", async () => {
      const { log } = makeSb();
      await GET(req("Bearer s3cret"));
      expect(log.jobUpdates).toHaveLength(0);
      expect(log.draftUpdates).toHaveLength(0);
    });

    it("a failed reap never stops the publish run", async () => {
      makeSb({ reapError: { message: "boom" }, due: [{ id: "d1" }] });
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(publishDraft).mockResolvedValue({ ok: true, url: "u" });
      const body = await (await GET(req("Bearer s3cret"))).json();
      expect(body).toMatchObject({ ok: true, published: 1, reaped: 0 });
    });
  });
});
