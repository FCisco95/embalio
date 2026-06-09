import { describe, it, expect, vi, beforeEach } from "vitest";

const sendTelegram = vi.fn();
const getStreak = vi.fn();
vi.mock("@/lib/telegram", () => ({ sendTelegram: (...a: unknown[]) => sendTelegram(...a) }));
vi.mock("@/server/streak", () => ({ getStreak: (...a: unknown[]) => getStreak(...a) }));

const profileRow = { data: { retention: {} } as Record<string, unknown> | null };
const postsRows = { data: [] as Array<{ posted_at: string | null }> };
const updateSpy = vi.fn();

function makeFrom() {
  return (table: string) => {
    if (table === "profiles") {
      return {
        select: () => ({ eq: () => ({ single: () => Promise.resolve(profileRow) }) }),
        update: (vals: unknown) => ({ eq: () => { updateSpy(vals); return Promise.resolve({ error: null }); } }),
      };
    }
    return { select: () => ({ eq: () => Promise.resolve(postsRows) }) };
  };
}
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: async () => ({ from: makeFrom() }) }));

import { runNudge } from "@/server/nudge";

beforeEach(() => {
  sendTelegram.mockReset();
  getStreak.mockReset().mockResolvedValue(0);
  updateSpy.mockReset();
  profileRow.data = { retention: { nudge: { lastSentDate: null, consecutiveIgnored: 0, optedOut: false, sendHour: 0 } } };
  postsRows.data = [];
});

describe("runNudge", () => {
  it("sends and stamps lastSentDate when the gate passes", async () => {
    const r = await runNudge("p1");
    expect(r.sent).toBe(true);
    expect(sendTelegram).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalled();
  });
  it("does not send when an action already happened today", async () => {
    postsRows.data = [{ posted_at: new Date().toISOString() }];
    const r = await runNudge("p1");
    expect(r.sent).toBe(false);
    expect(sendTelegram).not.toHaveBeenCalled();
  });
  it("fails safe (no throw) on a telegram error", async () => {
    sendTelegram.mockRejectedValue(new Error("boom"));
    const r = await runNudge("p1");
    expect(r.sent).toBe(false);
    expect(r.error).toContain("boom");
  });
});
