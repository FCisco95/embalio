/**
 * GATE-2 evidence expiry — pure, no I/O.
 *
 * The scorecard reads a ROLLING window (`created_at >= now − windowDays`, see
 * src/server/gate.ts), so an acted alert whose outcome was never recorded simply
 * vanishes from the gate on a fixed date, taking its precision and cleared-2×
 * contribution with it. Nothing warned about that. These helpers let the UI say
 * when each piece of evidence drops off, and let the owner widen the window to
 * review history that the default 45 days has already hidden.
 */

const DAY_MS = 86_400_000;

/** Warn this many days before an alert ages out — enough notice to act on it. */
export const EXPIRY_WARN_DAYS = 7;

export const DEFAULT_WINDOW_DAYS = 45;
const MIN_WINDOW_DAYS = 7;
const MAX_WINDOW_DAYS = 3650;

function createdMs(createdAt: string | null | undefined): number | null {
  if (!createdAt) return null;
  const ms = Date.parse(createdAt);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Whole days until `createdAt` falls out of a `windowDays` window, relative to
 * `now`. 0 = drops off today; negative = already gone; null = unparseable.
 */
export function daysUntilWindowExit(
  createdAt: string | null | undefined,
  windowDays: number,
  now: Date,
): number | null {
  const ms = createdMs(createdAt);
  if (ms === null) return null;
  return Math.floor((ms + windowDays * DAY_MS - now.getTime()) / DAY_MS);
}

/** UTC date (YYYY-MM-DD) on which the alert leaves the window; null if unparseable. */
export function windowExitDate(createdAt: string | null | undefined, windowDays: number): string | null {
  const ms = createdMs(createdAt);
  if (ms === null) return null;
  return new Date(ms + windowDays * DAY_MS).toISOString().slice(0, 10);
}

/** Parse an untrusted `?window=` query value into a sane window length. */
export function clampWindowDays(raw: string | undefined): number {
  const n = Number(raw);
  if (!raw || !Number.isFinite(n)) return DEFAULT_WINDOW_DAYS;
  return Math.min(MAX_WINDOW_DAYS, Math.max(MIN_WINDOW_DAYS, Math.round(n)));
}
