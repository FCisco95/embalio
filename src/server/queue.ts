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
  /** Error of the most recent posting_jobs row for this draft, if any. */
  last_error: string | null;
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
  const drafts = data ?? [];
  if (drafts.length === 0) return [];

  // Latest posting_jobs.error per draft ("the UI shows the last job error"). A failed
  // lookup must not hide the queue: degrade to no error line.
  const lastError = new Map<string, string | null>();
  const { data: jobs, error: jobsErr } = await sb
    .from("posting_jobs")
    .select("draft_id, error, created_at")
    .in("draft_id", drafts.map((d) => d.id))
    .order("created_at", { ascending: false });
  if (jobsErr) console.error("[queue] posting_jobs lookup failed:", jobsErr.message);
  for (const j of jobs ?? []) {
    if (j.draft_id && !lastError.has(j.draft_id)) lastError.set(j.draft_id, j.error);
  }
  return drafts.map((d) => ({ ...d, last_error: lastError.get(d.id) ?? null }));
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
