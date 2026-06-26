import { describe, it, expect, vi, afterEach } from "vitest";
import {
  RETENTION_DAYS_DEFAULT,
  retentionDays,
  retentionCutoffIso,
  purgeExpiredSignals,
} from "@/lib/signals/retention";

describe("retentionCutoffIso", () => {
  it("subtracts the given days from now and returns an ISO string", () => {
    // 2026-06-26T00:00:00Z minus 90 days = 2026-03-28T00:00:00Z
    const now = new Date("2026-06-26T00:00:00Z");
    expect(retentionCutoffIso(now, 90)).toBe("2026-03-28T00:00:00.000Z");
  });

  it("is pure — does not mutate the passed Date", () => {
    const now = new Date("2026-06-26T00:00:00Z");
    retentionCutoffIso(now, 90);
    expect(now.toISOString()).toBe("2026-06-26T00:00:00.000Z");
  });
});

describe("retentionDays", () => {
  afterEach(() => {
    delete process.env.SIGNAL_RETENTION_DAYS;
  });

  it("defaults to 90 when SIGNAL_RETENTION_DAYS is unset", () => {
    delete process.env.SIGNAL_RETENTION_DAYS;
    expect(retentionDays()).toBe(RETENTION_DAYS_DEFAULT);
    expect(retentionDays()).toBe(90);
  });

  it("uses the env value when it is a positive integer", () => {
    process.env.SIGNAL_RETENTION_DAYS = "30";
    expect(retentionDays()).toBe(30);
  });

  it.each(["0", "-5", "abc", ""])(
    "falls back to the default for garbage value %p",
    (val) => {
      process.env.SIGNAL_RETENTION_DAYS = val;
      expect(retentionDays()).toBe(90);
    },
  );
});

describe("purgeExpiredSignals", () => {
  it("deletes signal_tweets older than the cutoff and returns the count", async () => {
    const select = vi
      .fn()
      .mockResolvedValue({ data: [{ id: "a" }, { id: "b" }], error: null });
    const lt = vi.fn().mockReturnValue({ select });
    const del = vi.fn().mockReturnValue({ lt });
    const from = vi.fn().mockReturnValue({ delete: del });
    const sb = { from };

    const now = new Date("2026-06-26T00:00:00Z");
    const res = await purgeExpiredSignals(sb as never, { now, days: 90 });

    expect(from).toHaveBeenCalledWith("signal_tweets");
    expect(del).toHaveBeenCalledOnce();
    expect(lt).toHaveBeenCalledWith("first_seen_at", "2026-03-28T00:00:00.000Z");
    expect(select).toHaveBeenCalledWith("id");
    expect(res).toEqual({ deleted: 2, cutoff: "2026-03-28T00:00:00.000Z" });
  });

  it("returns deleted: 0 when data is null", async () => {
    const select = vi.fn().mockResolvedValue({ data: null, error: null });
    const lt = vi.fn().mockReturnValue({ select });
    const del = vi.fn().mockReturnValue({ lt });
    const sb = { from: vi.fn().mockReturnValue({ delete: del }) };

    const res = await purgeExpiredSignals(sb as never, {
      now: new Date("2026-06-26T00:00:00Z"),
      days: 90,
    });
    expect(res.deleted).toBe(0);
  });

  it("throws (fails loud) when the delete returns an error", async () => {
    const select = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "boom" } });
    const lt = vi.fn().mockReturnValue({ select });
    const del = vi.fn().mockReturnValue({ lt });
    const sb = { from: vi.fn().mockReturnValue({ delete: del }) };

    await expect(
      purgeExpiredSignals(sb as never, { now: new Date("2026-06-26T00:00:00Z") }),
    ).rejects.toThrow("boom");
  });
});
