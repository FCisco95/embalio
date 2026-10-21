import { describe, it, expect, vi, beforeEach } from "vitest";

const assertOwnProfile = vi.fn<(id: string) => Promise<void>>();
vi.mock("@/server/auth", () => ({ assertOwnProfile: (id: string) => assertOwnProfile(id) }));

const upsert = vi.fn().mockResolvedValue({ error: null });
const deleteEqEndpoint = vi.fn().mockResolvedValue({ error: null });
const deleteEqProfile = vi.fn().mockReturnValue({ eq: deleteEqEndpoint });
const del = vi.fn().mockReturnValue({ eq: deleteEqProfile });
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
  assertOwnProfile.mockReset().mockResolvedValue(undefined);
  upsert.mockClear();
  del.mockClear();
  deleteEqProfile.mockClear();
  deleteEqEndpoint.mockClear();
});

describe("push subscription persistence", () => {
  it("rejects a profile the caller does not own before writing or deleting", async () => {
    assertOwnProfile.mockRejectedValue(new Error("Profile not found or access denied"));
    await expect(
      savePushSubscription("foreign", { endpoint: "https://p/1", p256dh: "a", auth: "b" }),
    ).rejects.toThrow("access denied");
    await expect(removePushSubscription("foreign", "https://p/1")).rejects.toThrow("access denied");
    expect(upsert).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

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

  it("removes by profile + endpoint", async () => {
    await removePushSubscription("profile-1", "https://p/1");
    expect(del).toHaveBeenCalled();
    expect(deleteEqProfile).toHaveBeenCalledWith("profile_id", "profile-1");
    expect(deleteEqEndpoint).toHaveBeenCalledWith("endpoint", "https://p/1");
  });
});
