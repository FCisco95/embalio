import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const not = vi.fn();
const gte = vi.fn(() => ({ not }));
const eq = vi.fn(() => ({ gte }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));

vi.mock("@/lib/supabase/server", () => ({ supabaseServer: async () => ({ from }) }));

import { getConsistencyGate } from "@/server/consistency";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-30T15:00:00Z"));
  not.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("getConsistencyGate", () => {
  it("reads posted_at for the profile from the start of the oldest window day", async () => {
    not.mockResolvedValue({ data: [{ posted_at: "2026-10-30T09:00:00Z", drafts: { kind: "original" } }], error: null });
    const r = await getConsistencyGate("p-1");
    expect(from).toHaveBeenCalledWith("posts");
    expect(select).toHaveBeenCalledWith("posted_at, drafts(kind)");
    expect(eq).toHaveBeenCalledWith("profile_id", "p-1");
    expect(gte).toHaveBeenCalledWith("posted_at", "2026-10-01T00:00:00.000Z");
    expect(not).toHaveBeenCalledWith("tweet_url", "is", null);
    expect(r.publishDays).toBe(1);
    expect(r.perDay).toHaveLength(30);
  });

  it("counts published ORIGINALS only: reply drafts never count, imported own posts (no draft) do", async () => {
    not.mockResolvedValue({
      data: [
        { posted_at: "2026-10-30T09:00:00Z", drafts: { kind: "original" } },
        { posted_at: "2026-10-29T09:00:00Z", drafts: { kind: "reply" } }, // a reply that carries a URL
        { posted_at: "2026-10-28T09:00:00Z", drafts: null }, // imported own post
        { posted_at: "2026-10-27T09:00:00Z", drafts: [{ kind: "reply" }] }, // array-shaped embed
        { posted_at: "2026-10-26T09:00:00Z", drafts: [{ kind: "original" }] },
      ],
      error: null,
    });
    const r = await getConsistencyGate("p-1");
    expect(r.publishDays).toBe(3);
    const posted = r.perDay.filter((d) => d.posts > 0).map((d) => d.date);
    expect(posted).toEqual(["2026-10-26", "2026-10-28", "2026-10-30"]);
  });

  it("throws on a read error instead of returning a fake zero card", async () => {
    not.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(getConsistencyGate("p-1")).rejects.toThrow("consistency read failed: boom");
  });
});
