"use server";
import { supabaseService } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { normalizeWatchHandle, MAX_ACTIVE_WATCH_TARGETS } from "@/lib/sniper/watch";

export interface WatchTarget {
  id: string;
  handle: string;
  priority: number;
}

export async function listWatchTargets(profileId: string): Promise<WatchTarget[]> {
  const sb = supabaseService();
  const { data } = await sb
    .from("watch_targets")
    .select("id, handle, priority")
    .eq("profile_id", profileId)
    .eq("active", true)
    .order("priority", { ascending: false });
  return data ?? [];
}

export async function addWatchTarget(
  profileId: string,
  rawHandle: string,
  priority = 1,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const handle = normalizeWatchHandle(rawHandle);
  if (!handle) return { ok: false, error: "That doesn't look like an X handle." };
  const sb = supabaseService();
  const { count } = await sb
    .from("watch_targets")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .eq("active", true);
  if ((count ?? 0) >= MAX_ACTIVE_WATCH_TARGETS) {
    return { ok: false, error: `Watch list is capped at ${MAX_ACTIVE_WATCH_TARGETS} handles.` };
  }
  const { error } = await sb
    .from("watch_targets")
    .upsert(
      { profile_id: profileId, handle, priority, active: true },
      { onConflict: "profile_id,handle" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/board");
  return { ok: true };
}

export async function removeWatchTarget(profileId: string, id: string): Promise<void> {
  const sb = supabaseService();
  await sb.from("watch_targets").update({ active: false }).eq("id", id).eq("profile_id", profileId);
  revalidatePath("/board");
}
