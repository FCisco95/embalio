import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Profiles a bearer-authenticated cron/scheduler route should act on. There is
 * no session, so the caller passes the service client: `?profile=<id>` narrows
 * to one account, otherwise every account, oldest first. Throws on a read error
 * so a DB outage is never mistaken for "no profiles".
 */
export async function resolveCronProfiles(
  req: Request,
  sb: SupabaseClient<Database>,
): Promise<{ id: string; handle: string }[]> {
  const only = new URL(req.url).searchParams.get("profile");
  let query = sb.from("profiles").select("id, handle").order("created_at");
  if (only) query = query.eq("id", only);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}
