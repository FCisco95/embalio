"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { assertOwnProfile } from "@/server/auth";
import { ACTIVE_PROFILE_COOKIE } from "@/server/active-profile";

export async function setActiveProfile(profileId: string): Promise<void> {
  // Ownership first: a foreign id must throw before any cookie is written.
  await assertOwnProfile(profileId);
  (await cookies()).set(ACTIVE_PROFILE_COOKIE, profileId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 31536000,
  });
  // The cookie write already re-renders the current page; this also drops the
  // cached RSC payload of every other route so none shows the old account.
  revalidatePath("/", "layout");
}
