import { describe, it, expect, vi } from "vitest";
import { logActivity } from "@/lib/activity";

describe("logActivity", () => {
  it("inserts the event row", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const sb = { from: vi.fn(() => ({ insert })) };
    await logActivity(sb as never, "prof-1", "reply_posted", { refId: "draft-9", meta: { via: "quick" } });
    expect(sb.from).toHaveBeenCalledWith("activity_events");
    expect(insert).toHaveBeenCalledWith({
      profile_id: "prof-1", kind: "reply_posted", ref_id: "draft-9", meta: { via: "quick" },
    });
  });

  it("never throws on db error", async () => {
    const sb = { from: vi.fn(() => ({ insert: vi.fn().mockResolvedValue({ error: { message: "boom" } }) })) };
    await expect(logActivity(sb as never, "p", "scan_run")).resolves.toBeUndefined();
  });

  it("never throws on unexpected exception", async () => {
    const sb = { from: vi.fn(() => { throw new Error("kaput"); }) };
    await expect(logActivity(sb as never, "p", "scan_run")).resolves.toBeUndefined();
  });
});
