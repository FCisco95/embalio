/**
 * Picks the active account out of the profiles the session user owns.
 *
 * A cookie naming a profile that no longer exists (deleted, or set by another
 * login on the same browser) must never strand the user, so it falls back to
 * the oldest profile. `null` only when the user owns none (-> /setup).
 */
export function resolveActiveProfile<T extends { id: string }>(
  profiles: T[],
  cookieId: string | undefined,
): T | null {
  if (profiles.length === 0) return null;
  return profiles.find((p) => p.id === cookieId) ?? profiles[0];
}
