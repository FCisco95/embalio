import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listProfiles } from "@/server/profiles";
import { resolveActiveProfile } from "@/lib/auth/active-profile";

export const ACTIVE_PROFILE_COOKIE = "embalio_profile";

/**
 * The account every (app) page operates on: the profile named by the
 * `embalio_profile` cookie, else the user's oldest one. `listProfiles()` is
 * RLS-scoped to the session user, so a forged cookie can only ever select one
 * of the caller's own profiles.
 *
 * `cache()` dedupes the layout + page reads within one render. A Server Action
 * that sets the cookie triggers a fresh render, so a stale cached value from
 * earlier in the same request is never what the user sees.
 */
export const getActiveProfile = cache(async () => {
  const [profiles, store] = await Promise.all([listProfiles(), cookies()]);
  return resolveActiveProfile(profiles, store.get(ACTIVE_PROFILE_COOKIE)?.value);
});

export async function requireActiveProfile() {
  const profile = await getActiveProfile();
  if (!profile) redirect("/setup");
  return profile;
}
