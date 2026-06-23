-- Manual-send (ToS redesign): the drafted reply, plus what/when the human actually sent.
-- draft_reply  = LLM draft generated at alert time, fed into the X reply-intent URL.
-- sent_reply_text = the exact text the human confirmed sending (feeds the near-dup cap).
-- sent_at       = when the human confirmed the manual send (feeds the daily/hourly caps).
alter table public.sniper_alerts add column if not exists draft_reply text;
alter table public.sniper_alerts add column if not exists sent_reply_text text;
alter table public.sniper_alerts add column if not exists sent_at timestamptz;

-- Caps query reads acted sends in a rolling 24h window, per profile.
create index if not exists sniper_alerts_sent_idx
  on public.sniper_alerts (profile_id, sent_at desc)
  where status = 'acted';
