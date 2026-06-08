function dayKey(d: Date): string { return d.toISOString().slice(0, 10); }
/**
 * Consecutive-day posting streak ending at `today` (or yesterday if today has no post yet).
 * Days are bucketed in UTC (both the post timestamps and the `today` anchor use getUTC* /
 * toISOString), so the streak is internally consistent regardless of server timezone —
 * and Vercel runs UTC. A user-local streak day would be a future per-profile-timezone change.
 */
export function computeStreak(postedAtIso: string[], today: Date): number {
  const days = new Set(postedAtIso.map((iso) => dayKey(new Date(iso))));
  if (days.size === 0) return 0;
  const cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (!days.has(dayKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (!days.has(dayKey(cursor))) return 0;
  }
  let streak = 0;
  while (days.has(dayKey(cursor))) { streak++; cursor.setUTCDate(cursor.getUTCDate() - 1); }
  return streak;
}
