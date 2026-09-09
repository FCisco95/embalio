import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export interface AuthProfile {
  id: string;
  handle: string;
}

export const getSessionUser = cache(async () => {
  try {
    const sb = await supabaseServer();
    const { data, error } = await sb.auth.getUser();
    if (error) return null;
    return data.user;
  } catch {
    // A broken/stale cookie must read as "signed out", never as a 500: the
    // layout then redirects to /login, whose proxy pass clears the cookies.
    return null;
  }
});

export const getCurrentProfile = cache(async (): Promise<AuthProfile | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("profiles")
    .select("id, handle")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
});

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireCurrentProfile() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/setup");
  return profile;
}

export async function assertOwnProfile(profileId: string): Promise<void> {
  const user = await requireSessionUser();
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Profile not found or access denied");
}
