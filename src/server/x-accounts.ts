"use server";
import { revalidatePath } from "next/cache";
import { supabaseService } from "@/lib/supabase/server";
import { assertOwnProfile } from "@/server/auth";
import { decryptSecret } from "@/lib/x-api/crypto";

// `x_accounts` is service-role only (tokens at rest), so these actions prove
// ownership with `assertOwnProfile` first, then use the service client.

export async function getXAccountStatus(profileId: string): Promise<{
  username: string;
  needsReauth: boolean;
  lastRefreshAt: string | null;
  lastError: string | null;
} | null> {
  await assertOwnProfile(profileId);
  const sb = supabaseService();
  const { data, error } = await sb
    .from("x_accounts")
    .select("x_username, needs_reauth, last_refresh_at, last_error")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    username: data.x_username,
    needsReauth: data.needs_reauth,
    lastRefreshAt: data.last_refresh_at,
    lastError: data.last_error,
  };
}

/** Revoke the grant at X (best effort), then delete the row. Also the undo for a wrong-account link. */
export async function disconnectXAccount(profileId: string): Promise<{ ok: true }> {
  await assertOwnProfile(profileId);
  const sb = supabaseService();
  const { data: row, error } = await sb
    .from("x_accounts")
    .select("access_token_enc, refresh_token_enc")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return { ok: true };

  try {
    const clientId = process.env.X_CLIENT_ID;
    const secret = process.env.X_CLIENT_SECRET;
    if (clientId && secret) {
      await fetch("https://api.x.com/2/oauth2/revoke", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          token: decryptSecret(row.refresh_token_enc),
          token_type_hint: "refresh_token",
          client_id: clientId,
        }).toString(),
      });
    }
  } catch (e) {
    // A dead/undecryptable token must never block the owner from unlinking.
    console.error("[x-accounts] revoke failed:", e instanceof Error ? e.message : e);
  }

  const { error: delErr } = await sb.from("x_accounts").delete().eq("profile_id", profileId);
  if (delErr) throw new Error(delErr.message);
  revalidatePath("/profiles");
  return { ok: true };
}
