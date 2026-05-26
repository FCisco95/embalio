"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createProfile(input: {
  handle: string; display_name?: string; niche_description?: string;
  voice_corpus: string[]; voice_notes?: string;
}) {
  const sb = await supabaseServer();
  const { data, error } = await sb.from("profiles").insert(input).select().single();
  if (error) throw new Error(error.message);
  revalidatePath("/profiles");
  return data;
}

export async function listProfiles() {
  const sb = await supabaseServer();
  const { data, error } = await sb.from("profiles").select("*").order("created_at");
  if (error) throw new Error(error.message);
  return data;
}

export async function addSeedTarget(input: { profile_id: string; handle?: string; list_url?: string; note?: string }) {
  const sb = await supabaseServer();
  const { error } = await sb.from("seed_targets").insert(input);
  if (error) throw new Error(error.message);
  revalidatePath("/profiles");
}

export async function listSeedTargets(profileId: string) {
  const sb = await supabaseServer();
  const { data, error } = await sb.from("seed_targets")
    .select("*").eq("profile_id", profileId).eq("active", true);
  if (error) throw new Error(error.message);
  return data;
}
