import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/server/telegram-poll", () => ({
  drainTelegramUpdates: vi.fn(async () => ({ applied: 0 })),
}));
vi.mock("@/lib/supabase/server", () => ({ supabaseService: () => ({}) }));
// The shared helper has its own tests; here it stands in for "?profile= narrows, else all, oldest first".
vi.mock("@/server/cron-profiles", () => ({
  resolveCronProfiles: vi.fn(async (req: Request) =>
    new URL(req.url).searchParams.get("profile")
      ? [{ id: "p2", handle: "two" }]
      : [{ id: "p1", handle: "one" }, { id: "p2", handle: "two" }],
  ),
}));

import { GET } from "./route";
import { drainTelegramUpdates } from "@/server/telegram-poll";

const call = (qs = "", auth: string | null = "Bearer secret") =>
  GET(new NextRequest(`https://x/api/telegram/poll${qs}`, { headers: auth ? { authorization: auth } : {} }));

describe("GET /api/telegram/poll", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "secret";
    vi.clearAllMocks();
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("401s without the bearer secret and drains nothing", async () => {
    const res = await call("", null);
    expect(res.status).toBe(401);
    expect(drainTelegramUpdates).not.toHaveBeenCalled();
  });

  it("is single-profile: drains only the FIRST profile (one global bot, per-profile offset)", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(drainTelegramUpdates).toHaveBeenCalledTimes(1);
    expect(drainTelegramUpdates).toHaveBeenCalledWith("p1");
  });

  it("drains only the profile named by ?profile=", async () => {
    await call("?profile=p2");
    expect(drainTelegramUpdates).toHaveBeenCalledTimes(1);
    expect(drainTelegramUpdates).toHaveBeenCalledWith("p2");
  });

  it("reports a 500 when the drain errors", async () => {
    vi.mocked(drainTelegramUpdates).mockResolvedValueOnce({ applied: 0, error: "bad token" });
    const res = await call();
    expect(res.status).toBe(500);
  });

  it("is a no-op 200 when there are no profiles", async () => {
    const { resolveCronProfiles } = await import("@/server/cron-profiles");
    vi.mocked(resolveCronProfiles).mockResolvedValueOnce([]);
    const res = await call();
    expect(res.status).toBe(200);
    expect(drainTelegramUpdates).not.toHaveBeenCalled();
  });
});
