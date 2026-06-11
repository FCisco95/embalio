"use client";
import { useEffect, useState } from "react";
import { savePushSubscription } from "@/server/push-subscriptions";

type PushState = "checking" | "unsupported" | "denied" | "ready" | "subscribed" | "error";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function PushOptIn({ profileId }: { profileId: string }) {
  const [state, setState] = useState<PushState>("checking");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "subscribed" : "ready"))
      .catch(() => setState("error"));
  }, []);

  async function subscribe() {
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        setState("error");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });
      const json = sub.toJSON();
      await savePushSubscription(profileId, {
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent,
      });
      setState("subscribed");
    } catch (err) {
      console.error("push subscribe failed:", err);
      setState("error");
    }
  }

  if (state !== "ready") return null; // quiet unless there's an action to take
  return (
    <button
      onClick={subscribe}
      className="text-[12px] px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
    >
      🔔 Enable sniper alerts on this device
    </button>
  );
}
