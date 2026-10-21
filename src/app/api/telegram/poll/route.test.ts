import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/server/telegram-poll", () => ({
  drainTelegramUpdates: vi.fn(async () => ({ applied: 0 })),
}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseService: () => ({
    from: () => ({ select: () => ({ order: async () => ({ data: [{ id: "p1" }, { id: "p2" }], error: null }) }) }),
  }),
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

  it("drains updates for every profile when no ?profile= is given", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(drainTelegramUpdates).toHaveBeenCalledWith("p1");
    expect(drainTelegramUpdates).toHaveBeenCalledWith("p2");
  });

  it("drains only the profile named by ?profile=", async () => {
    await call("?profile=p2");
    expect(drainTelegramUpdates).toHaveBeenCalledTimes(1);
    expect(drainTelegramUpdates).toHaveBeenCalledWith("p2");
  });

  it("reports a 500 when any profile's drain errors, without skipping the rest", async () => {
    vi.mocked(drainTelegramUpdates).mockResolvedValueOnce({ applied: 0, error: "bad token" });
    const res = await call();
    expect(drainTelegramUpdates).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(500);
  });
});
