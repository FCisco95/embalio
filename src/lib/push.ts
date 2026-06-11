import webpush from "web-push";

/** Minimal web-push surface, injectable for tests. */
export interface WebPushImpl {
  setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  sendNotification(
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string,
  ): Promise<unknown>;
}

export interface WebPushSub {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface WebPushPayload {
  title: string;
  body: string;
  url?: string;
}

/** Subscription is dead (404/410) — caller should delete it from push_subscriptions. */
export class PushSubscriptionGone extends Error {
  constructor(public readonly endpoint: string) {
    super(`push subscription gone: ${endpoint}`);
  }
}

function vapid(): { subject: string; publicKey: string; privateKey: string } {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    throw new Error("VAPID_SUBJECT, VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set");
  }
  return { subject, publicKey, privateKey };
}

export async function sendWebPush(
  sub: WebPushSub,
  payload: WebPushPayload,
  impl: WebPushImpl = webpush,
): Promise<void> {
  const v = vapid();
  impl.setVapidDetails(v.subject, v.publicKey, v.privateKey);
  try {
    await impl.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    );
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) throw new PushSubscriptionGone(sub.endpoint);
    throw err;
  }
}
