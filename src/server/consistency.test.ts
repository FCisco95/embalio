import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const gte = vi.fn();
const eq = vi.fn(() => ({ gte }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));

vi.mock("@/lib/supabase/server", () => ({ supabaseServer: async () => ({ from }) }));

import { getConsistencyGate } from "@/server/consistency";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-30T15:00:00Z"));
  gte.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("getConsistencyGate", () => {
  it("reads posted_at for the profile from the start of the oldest window day", async () => {
    gte.mockResolvedValue({ data: [{ posted_at: "2026-10-30T09:00:00Z" }], error: null });
    const r = await getConsistencyGate("p-1");
    expect(from).toHaveBeenCalledWith("posts");
    expect(select).toHaveBeenCalledWith("posted_at");
    expect(eq).toHaveBeenCalledWith("profile_id", "p-1");
    expect(gte).toHaveBeenCalledWith("posted_at", "2026-10-01T00:00:00.000Z");
    expect(r.publishDays).toBe(1);
    expect(r.perDay).toHaveLength(30);
  });

  it("throws on a read error instead of returning a fake zero card", async () => {
    gte.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(getConsistencyGate("p-1")).rejects.toThrow("consistency read failed: boom");
  });
});
