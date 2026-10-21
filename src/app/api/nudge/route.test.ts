import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/server/nudge", () => ({ runNudge: vi.fn(async () => ({ sent: true })) }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseService: () => ({
    from: () => ({ select: () => ({ order: async () => ({ data: [{ id: "p1" }, { id: "p2" }], error: null }) }) }),
  }),
}));

import { GET } from "./route";
import { runNudge } from "@/server/nudge";

const call = (qs = "", auth: string | null = "Bearer secret") =>
  GET(new NextRequest(`https://x/api/nudge${qs}`, { headers: auth ? { authorization: auth } : {} }));

describe("GET /api/nudge", () => {
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
    expect(runNudge).not.toHaveBeenCalled();
  });

  it("nudges every profile when no ?profile= is given", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(runNudge).toHaveBeenCalledWith("p1");
    expect(runNudge).toHaveBeenCalledWith("p2");
  });

  it("nudges only the profile named by ?profile=", async () => {
    await call("?profile=p2");
    expect(runNudge).toHaveBeenCalledTimes(1);
    expect(runNudge).toHaveBeenCalledWith("p2");
  });

  it("reports a 500 when any profile's nudge errors, without skipping the rest", async () => {
    vi.mocked(runNudge).mockResolvedValueOnce({ sent: false, error: "no telegram" });
    const res = await call();
    expect(runNudge).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(500);
  });
});
