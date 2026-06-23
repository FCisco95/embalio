import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";

export type ActivityKind =
  | "reply_posted" | "post_published" | "engage_done" | "draft_created"
  | "csv_imported" | "sniper_alert_sent" | "sniper_alert_acted" | "sniper_reply_sent" | "scan_run";

/**
 * Append one row to the activity ledger. Never throws — activity logging must
 * never break the user action it decorates.
 */
export async function logActivity(
  sb: SupabaseClient<Database>,
  profileId: string,
  kind: ActivityKind,
  opts?: { refId?: string; meta?: Record<string, unknown> },
): Promise<void> {
  try {
    const { error } = await sb.from("activity_events").insert({
      profile_id: profileId, kind, ref_id: opts?.refId ?? null, meta: (opts?.meta ?? {}) as Json,
    });
    if (error) console.error("[activity] insert failed:", error.message);
  } catch (err) {
    console.error("[activity] unexpected:", err);
  }
}
