"use server";
import { supabaseService } from "@/lib/supabase/server";

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}

export async function savePushSubscription(
  profileId: string,
  sub: PushSubscriptionInput,
): Promise<void> {
  const sb = supabaseService();
  const { error } = await sb.from("push_subscriptions").upsert(
    {
      profile_id: profileId,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      user_agent: sub.userAgent ?? null,
    },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(`saving push subscription failed: ${error.message}`);
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const sb = supabaseService();
  const { error } = await sb.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) throw new Error(`removing push subscription failed: ${error.message}`);
}
