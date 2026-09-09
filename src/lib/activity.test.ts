import { describe, it, expect, vi } from "vitest";

const insert = vi.fn();
const from = vi.fn(() => ({ insert }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseService: () => ({ from }),
}));

import { logActivity } from "@/lib/activity";

describe("logActivity", () => {
  it("inserts the event row", async () => {
    insert.mockResolvedValue({ error: null });
    await logActivity(null, "prof-1", "reply_posted", { refId: "draft-9", meta: { via: "quick" } });
    expect(from).toHaveBeenCalledWith("activity_events");
    expect(insert).toHaveBeenCalledWith({
      profile_id: "prof-1", kind: "reply_posted", ref_id: "draft-9", meta: { via: "quick" },
    });
  });

  it("never throws on db error", async () => {
    insert.mockResolvedValue({ error: { message: "boom" } });
    await expect(logActivity(null, "p", "scan_run")).resolves.toBeUndefined();
  });

  it("never throws on unexpected exception", async () => {
    from.mockImplementationOnce(() => { throw new Error("kaput"); });
    await expect(logActivity(null, "p", "scan_run")).resolves.toBeUndefined();
  });
});
