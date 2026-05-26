"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { draftOriginal } from "@/lib/drafting";
import { revalidatePath } from "next/cache";

export async function composeOriginal(profileId: string, topic: string) {
  const sb = await supabaseServer();
  const { data: profile, error } = await sb.from("profiles").select("*").eq("id", profileId).single();
  if (error || !profile) throw new Error("profile not found");
  const voiceProfile = {
    handle: profile.handle,
    niche_description: profile.niche_description,
    voice_corpus: profile.voice_corpus,
    voice_notes: profile.voice_notes,
  };
  const d = await draftOriginal(voiceProfile, topic);
  const { data, error: insErr } = await sb.from("drafts").insert({
    profile_id: profileId, kind: "original", body: d.body,
    suggested_visual: d.suggestedVisual, model_used: d.model_used,
  }).select().single();
  if (insErr) throw new Error(insErr.message);
  revalidatePath("/compose");
  return data;
}
