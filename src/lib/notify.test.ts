import { describe, it, expect, vi } from "vitest";
import { notify, type NotifyDeps } from "@/lib/notify";
import { PushSubscriptionGone } from "@/lib/push";

const payload = { title: "🎯 Sniper", body: "@big just posted", url: "/engage" };
const subs = [
  { endpoint: "https://p/1", p256dh: "a", auth: "b" },
  { endpoint: "https://p/2", p256dh: "c", auth: "d" },
];

function deps(overrides: Partial<NotifyDeps> = {}): NotifyDeps {
  return {
    sendTelegram: vi.fn().mockResolvedValue(undefined),
    loadPushSubs: vi.fn().mockResolvedValue(subs),
    sendPush: vi.fn().mockResolvedValue(undefined),
    prunePushSub: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("notify — unified fan-out", () => {
  it("sends to telegram and every push subscription", async () => {
    const d = deps();
    const r = await notify("profile-1", payload, d);
    expect(d.sendTelegram).toHaveBeenCalledOnce();
    expect(d.sendPush).toHaveBeenCalledTimes(2);
    expect(r).toEqual({ telegram: "sent", push: { sent: 2, failed: 0, pruned: 0 } });
  });

  it("telegram failure does not block push (and vice versa)", async () => {
    const d = deps({ sendTelegram: vi.fn().mockRejectedValue(new Error("tg down")) });
    const r = await notify("profile-1", payload, d);
    expect(r.telegram).toBe("failed");
    expect(r.push.sent).toBe(2);
  });

  it("skips telegram when no sender configured", async () => {
    const d = deps({ sendTelegram: undefined });
    const r = await notify("profile-1", payload, d);
    expect(r.telegram).toBe("skipped");
  });

  it("prunes dead subscriptions on PushSubscriptionGone and keeps going", async () => {
    const d = deps({
      sendPush: vi
        .fn()
        .mockRejectedValueOnce(new PushSubscriptionGone("https://p/1"))
        .mockResolvedValueOnce(undefined),
    });
    const r = await notify("profile-1", payload, d);
    expect(d.prunePushSub).toHaveBeenCalledWith("https://p/1");
    expect(r.push).toEqual({ sent: 1, failed: 0, pruned: 1 });
  });

  it("counts non-Gone push errors as failed without throwing", async () => {
    const d = deps({ sendPush: vi.fn().mockRejectedValue(new Error("boom")) });
    const r = await notify("profile-1", payload, d);
    expect(r.push).toEqual({ sent: 0, failed: 2, pruned: 0 });
  });

  it("leaves push at zeros when loading subscriptions throws", async () => {
    const d = deps({ loadPushSubs: vi.fn().mockRejectedValue(new Error("db down")) });
    const r = await notify("profile-1", payload, d);
    expect(r.telegram).toBe("sent");
    expect(r.push).toEqual({ sent: 0, failed: 0, pruned: 0 });
  });
});
