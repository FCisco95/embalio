import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/server/strategy", () => ({ runWeeklyStrategy: vi.fn(async () => ({ ok: true, weekOf: "2026-06-15", pushed: true })) }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseService: () => ({ from: () => ({ select: () => ({ eq: async () => ({ data: [{ profile_id: "p1" }] }) }) }) }),
}));

import { GET } from "./route";
import { runWeeklyStrategy } from "@/server/strategy";

describe("GET /api/cron/strategy", () => {
  beforeEach(() => { process.env.CRON_SECRET = "secret"; vi.clearAllMocks(); });
  afterEach(() => { delete process.env.CRON_SECRET; });

  it("401s without the secret and never runs the worker", async () => {
    const res = await GET(new Request("https://x/api/cron/strategy"));
    expect(res.status).toBe(401);
    expect(runWeeklyStrategy).not.toHaveBeenCalled();
  });

  it("runs runWeeklyStrategy for each active profile with the secret", async () => {
    const res = await GET(new Request("https://x/api/cron/strategy", { headers: { authorization: "Bearer secret" } }));
    expect(res.status).toBe(200);
    expect(runWeeklyStrategy).toHaveBeenCalledWith("p1");
  });
});
