import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Boundary mocks — never a real DB. The bearer guard is intentionally NOT mocked:
// we drive the real cronAuthError via process.env.CRON_SECRET (mirrors strategy/route.test.ts)
// so the route's actual bearer contract (header name, constant-time compare, unset-secret branch)
// is exercised end-to-end.
const SERVICE_CLIENT = { __service: true };
vi.mock("@/lib/supabase/server", () => ({ supabaseService: () => SERVICE_CLIENT }));

vi.mock("@/lib/signals/retention", () => ({
  purgeExpiredSignals: vi.fn(async () => ({ deleted: 3, cutoff: "2026-03-28T00:00:00.000Z" })),
}));

import { GET } from "./route";
import { purgeExpiredSignals } from "@/lib/signals/retention";

const authed = () =>
  new Request("https://x/api/cron/signal-retention", { headers: { authorization: "Bearer secret" } });

describe("GET /api/cron/signal-retention", () => {
  beforeEach(() => { process.env.CRON_SECRET = "secret"; vi.clearAllMocks(); });
  afterEach(() => { delete process.env.CRON_SECRET; });

  it("401s without the secret and never purges", async () => {
    const res = await GET(new Request("https://x/api/cron/signal-retention") as never);
    expect(res.status).toBe(401);
    expect(purgeExpiredSignals).not.toHaveBeenCalled();
  });

  it("purges with the service client and returns 200 { ok, deleted, cutoff }", async () => {
    const res = await GET(authed() as never);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      deleted: 3,
      cutoff: "2026-03-28T00:00:00.000Z",
    });
    expect(purgeExpiredSignals).toHaveBeenCalledWith(SERVICE_CLIENT);
  });

  it("returns 500 { ok:false } when purgeExpiredSignals throws", async () => {
    vi.mocked(purgeExpiredSignals).mockRejectedValueOnce(new Error("boom"));
    const res = await GET(authed() as never);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(typeof body.error).toBe("string");
  });
});
