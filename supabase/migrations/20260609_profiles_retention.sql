-- Additive: per-profile retention bookkeeping (nudge state + Telegram getUpdates cursor).
alter table profiles
  add column if not exists retention jsonb not null default '{}'::jsonb;
