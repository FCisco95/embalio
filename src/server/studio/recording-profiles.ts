"use server";
import { supabaseService } from "@/lib/supabase/server";
import { listProfiles } from "@/server/profiles";
import { revalidatePath } from "next/cache";
import {
  defaultSeedProfiles as _defaultSeedProfiles,
  type RecordingProfileInput,
} from "./recording-profile-seeds";

// Re-export the pure builder and the input type so callers can import from one place.
export { defaultSeedProfiles } from "./recording-profile-seeds";
export type { RecordingProfileInput } from "./recording-profile-seeds";

export async function getActiveProfile() {
  const profiles = await listProfiles();
  const profile = profiles?.[0];
  if (!profile) throw new Error("no profile configured");
  return profile;
}

export async function listRecordingProfiles(profileId: string) {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("recording_profiles")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function seedRecordingProfilesIfEmpty(profileId: string) {
  const existing = await listRecordingProfiles(profileId);
  if (existing.length > 0) return existing;
  const sb = supabaseService();
  const seeds = _defaultSeedProfiles(profileId).map((s) => ({
    ...s,
    monitors: s.monitors as never,
    scene_presets: s.scene_presets as never,
  }));
  const { data, error } = await sb
    .from("recording_profiles")
    .insert(seeds)
    .select("*");
  if (error) throw new Error(error.message);
  revalidatePath("/studio");
  return data ?? [];
}

export async function createRecordingProfile(input: RecordingProfileInput) {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("recording_profiles")
    .insert({
      ...input,
      monitors: input.monitors as never,
      scene_presets: input.scene_presets as never,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/studio");
  return data;
}
