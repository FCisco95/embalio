-- GATE-2 dogfood instrumentation: capture skip reasons + manual reply outcomes on
-- sniper_alerts so the self-dogfood is scoreable (precision, false-alert rate,
-- author-reply-back rate, cleared-2x reach). All additive + nullable + idempotent.
-- Manual entry only — no X-analytics scrape. RLS stays disabled (P7 service-role posture).

alter table public.sniper_alerts
  add column if not exists skip_reason text
    check (skip_reason is null or skip_reason in ('off_niche','stale','bait','wrong_size','other')),
  add column if not exists reply_impressions int,
  add column if not exists author_median_reply_impressions int,
  add column if not exists author_reply_back boolean;
