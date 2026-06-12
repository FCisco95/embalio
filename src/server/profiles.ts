"use server"
import { supabaseService } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

const FIXED_PROFILE_ID = process.env.FIXED_PROFILE_ID

export async function createProfile(input: {
  handle: string
  display_name?: string
  niche_description?: string
  voice_corpus: string[]
  voice_notes?: string
}) {
  const sb = supabaseService()
  const { data, error } = await sb.from("profiles").insert(input).select().single()
  if (error) throw new Error(error.message)
  revalidatePath("/profiles")
  return data
}

export async function listProfiles() {
  const sb = supabaseService()
  let query = sb.from("profiles").select("*").order("created_at")
  if (FIXED_PROFILE_ID) {
    query = query.eq("id", FIXED_PROFILE_ID)
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

export async function addSeedTarget(input: {
  profile_id: string
  handle?: string
  list_url?: string
  note?: string
}) {
  const sb = supabaseService()
  const { error } = await sb.from("seed_targets").insert(input)
  if (error) throw new Error(error.message)
  revalidatePath("/profiles")
}

export async function listSeedTargets(profileId: string) {
  const sb = supabaseService()
  const { data, error } = await sb
    .from("seed_targets")
    .select("*")
    .eq("profile_id", profileId)
    .eq("active", true)
  if (error) throw new Error(error.message)
  return data
}

const ALLOWED_OPTIMIZATION_FIELDS = new Set(["bio_optimized", "pinned_optimized"] as const)

export async function toggleProfileOptimized(
  profileId: string,
  field: "bio_optimized" | "pinned_optimized",
  value: boolean,
): Promise<void> {
  if (!ALLOWED_OPTIMIZATION_FIELDS.has(field)) throw new Error(`invalid field: ${field}`)
  if (FIXED_PROFILE_ID && profileId !== FIXED_PROFILE_ID) throw new Error("profile_id mismatch")
  const sb = supabaseService()
  const patch = field === "bio_optimized" ? { bio_optimized: value } : { pinned_optimized: value }
  const { error } = await sb.from("profiles").update(patch).eq("id", profileId)
  if (error) throw new Error(error.message)
  revalidatePath("/")
}
