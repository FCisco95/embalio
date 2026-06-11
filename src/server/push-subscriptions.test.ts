import { describe, it, expect, vi, beforeEach } from "vitest";

const upsert = vi.fn().mockResolvedValue({ error: null });
const del = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
vi.mock("@/lib/supabase/server", () => ({
  supabaseService: () => ({
    from: vi.fn((table: string) => {
      if (table !== "push_subscriptions") throw new Error(`unexpected table ${table}`);
      return { upsert, delete: del };
    }),
  }),
}));

import { savePushSubscription, removePushSubscription } from "@/server/push-subscriptions";

beforeEach(() => {
  upsert.mockClear();
  del.mockClear();
});

describe("push subscription persistence", () => {
  it("upserts on endpoint so re-subscribing the same browser is idempotent", async () => {
    await savePushSubscription("profile-1", {
      endpoint: "https://p/1",
      p256dh: "a",
      auth: "b",
      userAgent: "x",
    });
    expect(upsert).toHaveBeenCalledWith(
      { profile_id: "profile-1", endpoint: "https://p/1", p256dh: "a", auth: "b", user_agent: "x" },
      { onConflict: "endpoint" },
    );
  });

  it("removes by endpoint", async () => {
    await removePushSubscription("https://p/1");
    expect(del).toHaveBeenCalled();
  });
});
