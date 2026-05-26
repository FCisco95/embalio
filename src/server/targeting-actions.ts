"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { refreshTargetsForProfile } from "./targeting";

// Verifies the caller owns the profile (RLS-scoped read) before delegating to
// the service-role orchestrator, which otherwise bypasses RLS.
export async function refreshTargets(profileId: string): Promise<number> {
  const sb = await supabaseServer();
  const { data } = await sb.from("profiles").select("id").eq("id", profileId).single();
  if (!data) throw new Error("Profile not found or access denied");
  return refreshTargetsForProfile(profileId);
}
