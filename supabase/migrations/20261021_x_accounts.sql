-- 2026-10 revamp, Day-0 contract (1/5): per-profile X OAuth 2.0 user-context tokens.
-- One X account per Embalio profile; one profile per X account (x_user_id unique).
-- Tokens are AES-256-GCM encrypted at rest by the app (X_TOKEN_ENC_KEY): the DB
-- never sees plaintext. Service-role only: no anon/authenticated access.
-- Plan: docs/superpowers/plans/2026-10-21-revamp-plan.md (section 1)

create table if not exists public.x_accounts (
  profile_id         uuid primary key references public.profiles(id) on delete cascade,
  x_user_id          text not null unique,
  x_username         text not null,
  access_token_enc   text not null,
  refresh_token_enc  text not null,
  access_expires_at  timestamptz not null,
  scopes             text not null,
  -- optimistic lock for refresh-token rotation (X rotates on every refresh)
  token_version      int not null default 0,
  needs_reauth       boolean not null default false,
  last_refresh_at    timestamptz,
  last_error         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.x_accounts enable row level security;
revoke all privileges on table public.x_accounts from anon, authenticated;
