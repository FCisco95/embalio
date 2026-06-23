import { supabaseService } from "@/lib/supabase/server";
import type { SentAction } from "@/lib/engagement/caps";

/** Acted sniper sends in the last 24h for a profile — the window the caps read. */
export async function loadRecentSends(profileId: string, nowMs = Date.now()): Promise<SentAction[]> {
  const sb = supabaseService();
  const cutoff = new Date(nowMs - 86_400_000).toISOString();
  const { data } = await sb
    .from("sniper_alerts")
    .select("author_handle, sent_at, sent_reply_text")
    .eq("profile_id", profileId)
    .eq("status", "acted")
    .gte("sent_at", cutoff);
  return (data ?? [])
    .filter((r) => r.sent_at)
    .map((r) => ({
      authorHandle: r.author_handle,
      sentAt: new Date(r.sent_at as string).getTime(),
      replyText: r.sent_reply_text ?? "",
    }));
}
