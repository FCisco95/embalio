"use server";
import { supabaseService } from "@/lib/supabase/server";
import { assertFixedProfileAccess } from "@/server/fixed-profile";

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
  assertFixedProfileAccess(profileId);
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

export async function removePushSubscription(profileId: string, endpoint: string): Promise<void> {
  assertFixedProfileAccess(profileId);
  const sb = supabaseService();
  const { error } = await sb.from("push_subscriptions").delete().eq("profile_id", profileId).eq("endpoint", endpoint);
  if (error) throw new Error(`removing push subscription failed: ${error.message}`);
}
