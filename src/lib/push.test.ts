import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendWebPush, PushSubscriptionGone, type WebPushSub } from "@/lib/push";

const sub: WebPushSub = { endpoint: "https://push.example/abc", p256dh: "k1", auth: "k2" };
const payload = { title: "t", body: "b", url: "/engage" };

beforeEach(() => {
  process.env.VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
  process.env.VAPID_SUBJECT = "mailto:test@example.com";
});

describe("sendWebPush", () => {
  it("throws a clear error when VAPID env is missing", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    await expect(sendWebPush(sub, payload)).rejects.toThrow(/VAPID/);
  });

  it("sends the JSON payload to the subscription endpoint", async () => {
    const impl = { setVapidDetails: vi.fn(), sendNotification: vi.fn().mockResolvedValue({ statusCode: 201 }) };
    await sendWebPush(sub, payload, impl);
    expect(impl.sendNotification).toHaveBeenCalledWith(
      { endpoint: sub.endpoint, keys: { p256dh: "k1", auth: "k2" } },
      JSON.stringify(payload),
    );
  });

  it("converts 410 Gone into PushSubscriptionGone so callers can prune", async () => {
    const impl = {
      setVapidDetails: vi.fn(),
      sendNotification: vi.fn().mockRejectedValue(Object.assign(new Error("gone"), { statusCode: 410 })),
    };
    await expect(sendWebPush(sub, payload, impl)).rejects.toBeInstanceOf(PushSubscriptionGone);
  });
});
