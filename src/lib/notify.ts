import { PushSubscriptionGone, type WebPushPayload, type WebPushSub } from "@/lib/push";

/**
 * Unified alert fan-out (spec decision 6: Telegram AND PWA web push).
 * Channel-isolated: a failing/unconfigured channel never blocks the other.
 * All I/O is injected — server code wires real deps, tests wire mocks.
 */
export interface NotifyPayload extends WebPushPayload {
  /** Pre-formatted Telegram text; falls back to `${title}\n${body}` when absent. */
  telegramText?: string;
  /** Inline keyboard rows for the Telegram message (manual-send buttons). */
  telegramButtons?: import("@/lib/telegram").TelegramButton[][];
}

export interface NotifyDeps {
  /** Omit (undefined) when Telegram is not configured for this deployment. */
  sendTelegram?: (text: string, opts?: { buttons?: import("@/lib/telegram").TelegramButton[][]; parseMode?: "HTML" | "MarkdownV2" }) => Promise<void>;
  loadPushSubs: (profileId: string) => Promise<WebPushSub[]>;
  sendPush: (sub: WebPushSub, payload: WebPushPayload) => Promise<void>;
  prunePushSub: (endpoint: string) => Promise<void>;
}

export interface NotifyResult {
  telegram: "sent" | "failed" | "skipped";
  push: { sent: number; failed: number; pruned: number };
}

export async function notify(
  profileId: string,
  payload: NotifyPayload,
  deps: NotifyDeps,
): Promise<NotifyResult> {
  const result: NotifyResult = { telegram: "skipped", push: { sent: 0, failed: 0, pruned: 0 } };

  const telegramWork = (async () => {
    if (!deps.sendTelegram) return;
    try {
      await deps.sendTelegram(
        payload.telegramText ?? `${payload.title}\n${payload.body}`,
        { buttons: payload.telegramButtons },
      );
      result.telegram = "sent";
    } catch (err) {
      console.error("[notify] telegram failed:", err);
      result.telegram = "failed";
    }
  })();

  const pushWork = (async () => {
    let subs: WebPushSub[] = [];
    try {
      subs = await deps.loadPushSubs(profileId);
    } catch (err) {
      console.error("[notify] loading push subs failed:", err);
      return;
    }
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await deps.sendPush(sub, { title: payload.title, body: payload.body, url: payload.url });
          result.push.sent++;
        } catch (err) {
          if (err instanceof PushSubscriptionGone) {
            result.push.pruned++;
            await deps.prunePushSub(sub.endpoint).catch((e) =>
              console.error("[notify] prune failed:", e),
            );
          } else {
            console.error("[notify] push failed:", err);
            result.push.failed++;
          }
        }
      }),
    );
  })();

  await Promise.all([telegramWork, pushWork]);
  return result;
}
