/** Returns the most recent Monday at 00:00:00 UTC relative to `now`. */
export function getWeekStart(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // getUTCDay(): 0=Sun … 6=Sat → shift so Mon=0, Sun=6
  const dayOfWeek = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayOfWeek);
  return d;
}
