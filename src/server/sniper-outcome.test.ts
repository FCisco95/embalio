import { describe, it, expect, vi, beforeEach } from "vitest";

// Boundary-mock the service client + cache. The update builder is a thenable
// chain (update().eq().eq()[.eq()] then awaited), mirroring supabase-js.
let updatePayload: Record<string, unknown> | null;
let updateError: { message: string } | null;
let eqCalls: [string, unknown][];
let activityInserts: Record<string, unknown>[];

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseService: () => ({
    from: (t: string) => {
      if (t === "sniper_alerts") {
        return {
          update: (p: Record<string, unknown>) => {
            updatePayload = p;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const chain: any = {
              eq: (col: string, val: unknown) => {
                eqCalls.push([col, val]);
                return chain;
              },
              then: (res: (v: { error: unknown }) => unknown, rej?: (e: unknown) => unknown) =>
                Promise.resolve({ error: updateError }).then(res, rej),
            };
            return chain;
          },
        };
      }
      if (t === "activity_events") {
        return {
          insert: async (row: Record<string, unknown>) => {
            activityInserts.push(row);
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected ${t}`);
    },
  }),
}));

import { markSniperAlert, setReplyOutcome } from "./sniper";

beforeEach(() => {
  updatePayload = null;
  updateError = null;
  eqCalls = [];
  activityInserts = [];
});

describe("markSniperAlert + skip_reason", () => {
  it("dismissed with a reason writes status + skip_reason, logs no activity", async () => {
    await markSniperAlert("p1", "a1", "dismissed", "bait");
    expect(updatePayload).toEqual({ status: "dismissed", skip_reason: "bait" });
    expect(eqCalls).toEqual([
      ["id", "a1"],
      ["profile_id", "p1"],
    ]);
    expect(activityInserts).toHaveLength(0);
  });

  it("dismissed without a reason writes status only", async () => {
    await markSniperAlert("p1", "a1", "dismissed");
    expect(updatePayload).toEqual({ status: "dismissed" });
  });

  it("acted writes status and logs sniper_alert_acted", async () => {
    await markSniperAlert("p1", "a1", "acted");
    expect(updatePayload).toEqual({ status: "acted" });
    expect(activityInserts[0]).toMatchObject({ kind: "sniper_alert_acted", profile_id: "p1" });
  });

  it("rejects an invalid skip reason before any DB write", async () => {
    await expect(markSniperAlert("p1", "a1", "dismissed", "nope" as never)).rejects.toThrow(
      /invalid skip reason/,
    );
    expect(updatePayload).toBeNull();
  });

  it("surfaces a DB error", async () => {
    updateError = { message: "boom" };
    await expect(markSniperAlert("p1", "a1", "dismissed", "stale")).rejects.toThrow("boom");
  });
});

describe("setReplyOutcome", () => {
  it("writes only provided fields and guards status=acted", async () => {
    await setReplyOutcome("p1", "a1", { replyImpressions: 1200, authorReplyBack: true });
    expect(updatePayload).toEqual({ reply_impressions: 1200, author_reply_back: true });
    expect(eqCalls).toContainEqual(["status", "acted"]);
    expect(eqCalls).toContainEqual(["id", "a1"]);
    expect(eqCalls).toContainEqual(["profile_id", "p1"]);
  });

  it("writes the author median when supplied", async () => {
    await setReplyOutcome("p1", "a1", { authorMedianReplyImpressions: 40 });
    expect(updatePayload).toEqual({ author_median_reply_impressions: 40 });
  });

  it("no-ops on an empty outcome (no DB write)", async () => {
    await setReplyOutcome("p1", "a1", {});
    expect(updatePayload).toBeNull();
  });

  it("rejects a negative impression count (zod)", async () => {
    await expect(setReplyOutcome("p1", "a1", { replyImpressions: -5 })).rejects.toThrow();
    expect(updatePayload).toBeNull();
  });

  it("surfaces a DB error", async () => {
    updateError = { message: "db down" };
    await expect(setReplyOutcome("p1", "a1", { replyImpressions: 10 })).rejects.toThrow("db down");
  });
});
