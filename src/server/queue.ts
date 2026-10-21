import { supabaseServer, supabaseService } from "@/lib/supabase/server";
import { assertOwnProfile } from "@/server/auth";

// Read side of the approval queue. Plain module (pages call it); the writes live in
// queue-actions.ts. Drafts are read through the RLS client; the X link state comes
// from the service role because `x_accounts` has no anon/authenticated access.

export type QueueDraft = {
  id: string;
  body: string;
  angle: string | null;
  rationale: string | null;
  link_url: string | null;
  scheduled_at: string | null;
  status: string;
  created_at: string;
};

export type XConnection = { connected: boolean; username?: string; needsReauth?: boolean };

export async function listQueueDrafts(profileId: string): Promise<QueueDraft[]> {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("drafts")
    .select("id, body, angle, rationale, link_url, scheduled_at, status, created_at")
    .eq("profile_id", profileId)
    .eq("kind", "original")
    .in("status", ["draft", "approved", "scheduled"])
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Non-secret view of the profile's X link. Token columns are never selected. */
export async function getXConnection(profileId: string): Promise<XConnection> {
  await assertOwnProfile(profileId);
  const sb = supabaseService();
  const { data, error } = await sb
    .from("x_accounts")
    .select("x_username, needs_reauth")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { connected: false };
  return { connected: true, username: data.x_username, needsReauth: data.needs_reauth };
}
