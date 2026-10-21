import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/server/pulse", () => ({
  runPulse: vi.fn(async () => ({ surfaced: 1, drafted: 1, sent: 1 })),
}));
// Cron has no session: the route must list profiles with the service client.
vi.mock("@/lib/supabase/server", () => ({
  supabaseService: () => ({
    from: () => ({ select: () => ({ order: async () => ({ data: [{ id: "p1" }, { id: "p2" }], error: null }) }) }),
  }),
}));

import { GET } from "./route";
import { runPulse } from "@/server/pulse";

const call = (qs = "", auth: string | null = "Bearer secret") =>
  GET(new NextRequest(`https://x/api/pulse${qs}`, { headers: auth ? { authorization: auth } : {} }));

describe("GET /api/pulse", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "secret";
    vi.clearAllMocks();
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("401s without the bearer secret and runs nothing", async () => {
    const res = await call("", null);
    expect(res.status).toBe(401);
    expect(runPulse).not.toHaveBeenCalled();
  });

  it("runs the pulse for every profile when no ?profile= is given", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(runPulse).toHaveBeenCalledTimes(2);
    expect(runPulse).toHaveBeenCalledWith("p1", { refresh: true });
    expect(runPulse).toHaveBeenCalledWith("p2", { refresh: true });
  });

  it("runs only the profile named by ?profile=, honouring ?refresh=0", async () => {
    await call("?profile=p2&refresh=0");
    expect(runPulse).toHaveBeenCalledTimes(1);
    expect(runPulse).toHaveBeenCalledWith("p2", { refresh: false });
  });

  it("keeps going after one profile throws, and reports a 500", async () => {
    vi.mocked(runPulse).mockRejectedValueOnce(new Error("boom"));
    const res = await call();
    expect(runPulse).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(500);
  });
});
