import { sendTelegram } from "@/lib/telegram";
import { sendWebPush } from "@/lib/push";
import type { NotifyDeps } from "@/lib/notify";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/** Real Telegram + web-push deps for notify(). Telegram gated on env. `sb` is a supabaseService()/supabaseServer() client. */
export function buildNotifyDeps(sb: SupabaseClient<Database>): NotifyDeps {
  const telegramConfigured = !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
  return {
    sendTelegram: telegramConfigured ? (text) => sendTelegram(text) : undefined,
    loadPushSubs: async (pid) => {
      const { data } = await sb.from("push_subscriptions").select("endpoint, p256dh, auth").eq("profile_id", pid);
      return data ?? [];
    },
    sendPush: (sub, payload) => sendWebPush(sub, payload),
    prunePushSub: async (endpoint) => { await sb.from("push_subscriptions").delete().eq("endpoint", endpoint); },
  };
}
